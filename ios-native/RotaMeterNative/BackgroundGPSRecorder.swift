import CoreLocation
import Foundation
import ActivityKit
import AVFoundation

/// Owns the location session independently from the WKWebView lifecycle.
/// NOTE: A user force-quitting iOS apps can stop location delivery; iOS manages the process.
final class BackgroundGPSRecorder: NSObject, CLLocationManagerDelegate, AVSpeechSynthesizerDelegate {
    static let shared = BackgroundGPSRecorder()
    private let manager = CLLocationManager()
    private let defaults = UserDefaults.standard
    private var tracking = false
    private var tripId: String?
    private var previous: CLLocation?
    private var tripStart: Date?
    private var nativeMeters = 0.0
    private var lastLiveUpdate = Date.distantPast
    private var liveActivity: Activity<TripActivityAttributes>?
    // Audio directions require a planned route and explicit start by the driver.
    // This is experimental guidance, not an offline/traffic-aware navigation engine.
    private let speechEngine = AVSpeechSynthesizer()
    private var voiceRouteId = ""
    private var voiceSteps: [VoiceStep] = []
    private var spokenCues = Set<String>()
    private var lastOffRouteWarning = Date.distantPast
    private var readCursorTripId: String?
    private var readCursorOffset: UInt64 = 0
    private var readCursorWatermark = 0.0

    private struct VoiceStep {
        let latitude: Double
        let longitude: Double
        let text: String
        let index: Int
    }

    func setVoiceRoute(id: String, steps: [[String: Any]]) {
        guard id.count <= 100 else { return }
        if id != voiceRouteId {
            spokenCues.removeAll()
            voiceRouteId = id
        }
        voiceSteps = steps.prefix(100).enumerated().compactMap { index, item in
            guard let lat = item["lat"] as? Double, let lon = item["lon"] as? Double,
                  abs(lat) <= 90, abs(lon) <= 180,
                  let text = item["text"] as? String, !text.isEmpty else { return nil }
            return VoiceStep(latitude: lat, longitude: lon,
                text: String(text.prefix(140)), index: index)
        }
    }

    func clearVoiceRoute() {
        voiceRouteId = ""
        voiceSteps.removeAll()
        spokenCues.removeAll()
    }

    private func speakDirection(_ words: String) {
        guard tracking, !words.isEmpty else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio,
                options: [.mixWithOthers, .duckOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { onError?("Aviso de áudio: \(error.localizedDescription)") }
        let voice = AVSpeechUtterance(string: words)
        voice.voice = AVSpeechSynthesisVoice(language: "pt-PT")
        voice.rate = 0.49
        speechEngine.speak(voice)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        // Avoid holding an audio session over Spotify after speaking a maneuver.
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func updateVoiceGuidance(for loc: CLLocation) {
        guard tracking, !voiceSteps.isEmpty else { return }
        // Announce only when genuinely close to the maneuver. Wrong-route or
        // out-of-order points cannot be used to claim that a turn was completed.
        for step in voiceSteps {
            let key = "\(voiceRouteId):\(step.index)"
            if spokenCues.contains(key) { continue }
            let target = CLLocation(latitude: step.latitude, longitude: step.longitude)
            let distance = loc.distance(from: target)
            if distance < 90 {
                spokenCues.insert(key)
                speakDirection(step.text)
                break
            }
            if distance > 140 { break }
        }
    }
    var onCurrentFix: (([String: Any]) -> Void)?
    var onError: ((String) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        speechEngine.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 5
        manager.activityType = .automotiveNavigation
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
        tripId = defaults.string(forKey: "rm.native.tripId")
        tracking = defaults.bool(forKey: "rm.native.active") && tripId != nil
        nativeMeters = defaults.double(forKey: "rm.native.meters")
        if let seconds = defaults.object(forKey: "rm.native.start") as? Double {
            tripStart = Date(timeIntervalSince1970: seconds)
        }
        // Recover tracking after ordinary process termination, subject to OS authorization.
        if tracking { DispatchQueue.main.async { [weak self] in
            self?.configureAndTrack()
            self?.startLiveActivity()
        } }
    }

    private var recordURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base.appendingPathComponent("rotameter_\(tripId ?? "none").ndjson")
    }

    func requestLocation() {
        guard CLLocationManager.locationServicesEnabled() else {
            onError?("Ative os Serviços de Localização no iPhone.")
            return
        }
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .denied, .restricted: onError?("Autorize a localização nas Definições do iPhone.")
        default:
            if tracking { manager.startUpdatingLocation() }
            else { manager.requestLocation() }
        }
    }

    func startTracking(id: String, startedAt: Double) {
        guard !id.isEmpty, id.count <= 64,
              id.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            onError?("Identificador da viagem inválido.")
            return
        }
        let isNew = id != tripId
        if isNew {
            tripId = id
            nativeMeters = 0
            previous = nil
            tripStart = Date(timeIntervalSince1970: startedAt / 1000)
            // Only initialise a brand-new trip file; resume never truncates old route data.
            try? Data().write(to: recordURL, options: .atomic)
            try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: recordURL.path)
        }
        tracking = true
        defaults.set(id, forKey: "rm.native.tripId")
        defaults.set(true, forKey: "rm.native.active")
        defaults.set(tripStart?.timeIntervalSince1970 ?? Date().timeIntervalSince1970, forKey: "rm.native.start")
        defaults.set(nativeMeters, forKey: "rm.native.meters")
        configureAndTrack()
        startLiveActivity()
    }

    func pauseTracking() {
        tracking = false
        defaults.set(false, forKey: "rm.native.active")
        previous = nil
        manager.allowsBackgroundLocationUpdates = false
        manager.stopUpdatingLocation()
        speechEngine.stopSpeaking(at: .immediate)
        updateLiveActivity(status: "Pausado", force: true)
    }

    func resumeTracking(id: String) {
        guard id == tripId, let start = tripStart else {
            onError?("Sessão nativa não encontrada. Volte a abrir a viagem para sincronizar.")
            return
        }
        startTracking(id: id, startedAt: start.timeIntervalSince1970 * 1000)
        previous = nil // do not bridge the stationary interval
    }

    func stopTracking() {
        tracking = false
        defaults.set(false, forKey: "rm.native.active")
        manager.allowsBackgroundLocationUpdates = false
        manager.stopUpdatingLocation()
        speechEngine.stopSpeaking(at: .immediate)
        clearVoiceRoute()
        updateLiveActivity(status: "Concluído", force: true)
        endLiveActivity()
    }

    private func configureAndTrack() {
        guard CLLocationManager.locationServicesEnabled() else { return }
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.allowsBackgroundLocationUpdates = tracking
            if tracking { manager.startUpdatingLocation() }
            else { manager.requestLocation() }
            // When-in-use with foreground-initiated ongoing navigation can keep updating.
            // If Apple offers Always permission, the user decides whether to grant it.
        default: onError?("GPS não autorizado. Altere a permissão nas Definições.")
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            configureAndTrack()
        } else if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
            onError?("Localização recusada. Ative a permissão nas Definições do iPhone.")
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for loc in locations.sorted(by: { $0.timestamp < $1.timestamp }) {
            guard loc.horizontalAccuracy >= 0, loc.horizontalAccuracy <= 60,
                  abs(loc.timestamp.timeIntervalSinceNow) <= 20 else { continue }
            let record: [String: Any] = [
                "lat": loc.coordinate.latitude,
                "lon": loc.coordinate.longitude,
                "accuracy": loc.horizontalAccuracy,
                "ts": loc.timestamp.timeIntervalSince1970 * 1000,
                "speed": loc.speed >= 0 ? loc.speed : NSNull(),
                "heading": loc.course >= 0 ? loc.course : NSNull()
            ]
            if tracking {
                if let last = previous {
                    let dt = loc.timestamp.timeIntervalSince(last.timestamp)
                    let distance = loc.distance(from: last)
                    if dt > 0, dt <= 150,
                       distance <= 57 * dt + max(loc.horizontalAccuracy, last.horizontalAccuracy) * 0.5,
                       distance > max(5, (loc.horizontalAccuracy + last.horizontalAccuracy) * 0.32) {
                        nativeMeters += distance
                        defaults.set(nativeMeters, forKey: "rm.native.meters")
                    }
                }
                previous = loc
                append(record)
                updateLiveActivity(status: "A acompanhar", force: false)
                updateVoiceGuidance(for: loc)
            }
            onCurrentFix?(record)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        onError?("GPS: \(error.localizedDescription)")
    }

    private func append(_ record: [String: Any]) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: record),
              var line = String(data: bytes, encoding: .utf8) else { return }
        line += "\n"
        guard let data = line.data(using: .utf8) else { return }
        let url = recordURL
        if !FileManager.default.fileExists(atPath: url.path) {
            try? data.write(to: url, options: .atomic)
        } else if let file = try? FileHandle(forWritingTo: url) {
            defer { try? file.close() }
            try? file.seekToEnd()
            try? file.write(contentsOf: data)
        }
    }

    /// Stream a bounded batch. Never load an entire multi-hour GPS log into RAM.
    /// Timestamp watermarks are passed by JS; duplicate positions are rejected
    /// again by the web calculation engine.
    func readRecordedFixes(since: Double = 0, limit: Int = 400) -> [[String: Any]] {
        guard let file = try? FileHandle(forReadingFrom: recordURL) else { return [] }
        defer { try? file.close() }
        let safeLimit = min(500, max(1, limit))
        var points: [[String: Any]] = []
        let reuseCursor = readCursorTripId == tripId && since >= readCursorWatermark
        if reuseCursor && readCursorOffset > 0 {
            try? file.seek(toOffset: readCursorOffset)
        } else {
            try? file.seek(toOffset: 0)
        }
        var buffer = Data()
        var newest = since
        while points.count < safeLimit {
            guard let chunk = try? file.read(upToCount: 16384), !chunk.isEmpty else { break }
            buffer.append(chunk)
            while let end = buffer.firstIndex(of: 10) {
                let line = Data(buffer[..<end])
                buffer.removeSubrange(...end)
                if let json = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                   let ts = json["ts"] as? Double, ts > since {
                    points.append(json)
                    newest = ts
                    if points.count >= safeLimit { break }
                }
            }
            // Corrupt log line guard to prevent uncontrolled allocation.
            if buffer.count > 131072 { buffer.removeAll(keepingCapacity: true) }
        }
        // The offset is only reused after JS acknowledges data by supplying a
        // watermark >= newest. Requests with an older watermark restart at 0.
        readCursorTripId = tripId
        readCursorWatermark = newest
        readCursorOffset = file.offsetInFile >= UInt64(buffer.count)
            ? file.offsetInFile - UInt64(buffer.count) : 0
        return points
    }

    var isRecording: Bool { tracking }
    var currentTripId: String? { tripId }

    private func startLiveActivity() {
        guard ActivityAuthorizationInfo().areActivitiesEnabled, let id = tripId else { return }
        if let existing = Activity<TripActivityAttributes>.activities.first(where: { $0.attributes.tripId == id }) {
            liveActivity = existing
            return
        }
        let attrs = TripActivityAttributes(tripId: id, startDate: tripStart ?? Date())
        let state = TripActivityAttributes.ContentState(meters: nativeMeters, status: "A acompanhar")
        do { liveActivity = try Activity.request(attributes: attrs, content: .init(state: state, staleDate: nil), pushType: nil) }
        catch { onError?("Live Activity não disponível: \(error.localizedDescription)") }
    }

    private func updateLiveActivity(status: String, force: Bool) {
        guard force || Date().timeIntervalSince(lastLiveUpdate) >= 15 else { return }
        lastLiveUpdate = Date()
        let updated = TripActivityAttributes.ContentState(meters: nativeMeters, status: status)
        if let activity = liveActivity {
            Task { await activity.update(.init(state: updated, staleDate: nil)) }
        }
    }

    private func endLiveActivity() {
        guard let activity = liveActivity else { return }
        liveActivity = nil
        let final = TripActivityAttributes.ContentState(meters: nativeMeters, status: "Concluído")
        Task { await activity.end(.init(state: final, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(30))) }
    }
}
