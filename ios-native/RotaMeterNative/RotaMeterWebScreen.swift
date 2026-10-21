import SwiftUI
import WebKit
import UIKit

struct RotaMeterWebScreen: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "rotameter")
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.isOpaque = false
        view.backgroundColor = .white
        context.coordinator.connect(view)
        if let file = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www")
            ?? Bundle.main.url(forResource: "index", withExtension: "html") {
            view.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent())
        } else {
            view.loadHTMLString("<html><body>Recursos web não incluídos no projeto iOS.</body></html>", baseURL: nil)
        }
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private weak var web: WKWebView?
        private let recorder = BackgroundGPSRecorder.shared
        private var activeObserver: NSObjectProtocol?
        private var lastSyncTimestamp = 0.0

        override init() {
            super.init()
            recorder.onCurrentFix = { [weak self] record in self?.send("onFix", value: record) }
            recorder.onError = { [weak self] error in self?.send("onError", value: error) }
            activeObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
                object: nil, queue: .main) { [weak self] _ in self?.syncRecordedFixes() }
        }
        deinit { if let observer = activeObserver { NotificationCenter.default.removeObserver(observer) } }
        func connect(_ view: WKWebView) { web = view }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "rotameter", let args = message.body as? [String: Any],
                  let type = args["type"] as? String else { return }
            switch type {
            case "location-read": recorder.requestLocation()
            case "tracking-start":
                if let id = args["id"] as? String, let startedAt = args["startedAt"] as? Double {
                    recorder.startTracking(id: id, startedAt: startedAt)
                }
            case "tracking-pause": recorder.pauseTracking()
            case "tracking-resume":
                if let id = args["id"] as? String { recorder.resumeTracking(id: id) }
            case "tracking-stop": recorder.stopTracking()
            case "tracking-sync":
                syncRecordedFixes(since: (args["since"] as? Double) ?? 0)
            case "navigation-voice-route":
                recorder.setVoiceRoute(id: (args["routeId"] as? String) ?? "",
                    steps: (args["steps"] as? [[String: Any]]) ?? [])
            case "navigation-voice-clear": recorder.clearVoiceRoute()
            default: break
            }
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            syncRecordedFixes()
        }
        private func send(_ method: String, value: Any) {
            guard let encoded = try? JSONSerialization.data(withJSONObject: ["data": value]),
                  let json = String(data: encoded, encoding: .utf8) else { return }
            DispatchQueue.main.async { [weak self] in
                self?.web?.evaluateJavaScript("window.RotaMeterNative?.\(method)(\(json).data)", completionHandler: nil)
            }
        }
        private func syncRecordedFixes(since: Double = 0) {
            let watermark = max(lastSyncTimestamp, since)
            let points = recorder.readRecordedFixes(since: watermark)
            guard !points.isEmpty else { return }
            // Advance only after JS processes the batch (using a small explicit ack in JS).
            send("ingestBatch", value: points)
        }
    }
}
