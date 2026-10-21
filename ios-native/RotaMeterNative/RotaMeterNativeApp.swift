import SwiftUI

@main
struct RotaMeterNativeApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                RotaMeterWebScreen()
                    .ignoresSafeArea()
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
    }
}
