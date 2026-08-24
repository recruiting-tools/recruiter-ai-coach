import SwiftUI

@main
struct CallTipsApp: App {
    @StateObject private var session = CallSession()
    @StateObject private var callController = CallController()
    @State private var showPreCall = true

    var body: some Scene {
        Window("Call Tips", id: "main") {
            if showPreCall {
                PreCallView(session: session) {
                    Task {
                        await callController.startCall(session: session)
                        showPreCall = false
                    }
                }
            } else {
                OverlayView(session: session) {
                    Task {
                        await callController.stopCall()
                        showPreCall = true
                    }
                }
                .onAppear { makeWindowFloat() }
            }
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
    }

    private func makeWindowFloat() {
        // Keep overlay on top of Zoom, Teams, etc.
        DispatchQueue.main.async {
            NSApp.windows.first { $0.identifier?.rawValue == "main" }?.level = .floating
        }
    }
}
