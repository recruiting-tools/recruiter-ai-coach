import SwiftUI

@main
struct CallTipsApp: App {
    @StateObject private var session        = CallSession()
    @StateObject private var callController = CallController()
    @State private var showPreCall = true

    var body: some Scene {
        Window("Call Tips", id: "main") {
            if showPreCall {
                PreCallView(
                    session: session,
                    apiKey: callController.openrouterKeyPublic
                ) {
                    Task {
                        await callController.startCall(session: session)
                        showPreCall = false
                    }
                }
            } else {
                OverlayView(session: session) {
                    Task {
                        await callController.stopCall()
                        session.isRecording = false
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
        DispatchQueue.main.async {
            guard let window = NSApp.windows.first(where: { $0.identifier?.rawValue == "main" }) else { return }
            window.level = .floating
            // Position at top-center of main screen (near webcam)
            if let screen = NSScreen.main {
                let sw = screen.visibleFrame.width
                let ww = window.frame.width
                let x = screen.visibleFrame.minX + (sw - ww) / 2
                let y = screen.visibleFrame.maxY - window.frame.height - 8
                window.setFrameOrigin(NSPoint(x: x, y: y))
            }
        }
    }
}
