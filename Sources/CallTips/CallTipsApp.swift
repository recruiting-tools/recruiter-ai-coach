import SwiftUI
import AppKit

@main
struct CallTipsApp: App {
    @StateObject private var session        = CallSession()
    @StateObject private var callController = CallController()
    @State private var isRecording          = false

    private let overlayController = OverlayWindowController()
    private let setupController   = SetupWindowController()

    var body: some Scene {
        MenuBarExtra {
            if isRecording {
                Label("Запись идёт", systemImage: "mic.fill").foregroundStyle(.red)
                Button("Завершить интервью") { Task { await stopCall() } }
            } else {
                Button("Показать / скрыть") {
                    setupController.toggle(
                        session: session,
                        apiKey: callController.openrouterKeyPublic,
                        onStart: { Task { await startCall() } }
                    )
                }
            }
            Divider()
            Button("Quit") { NSApplication.shared.terminate(nil) }
        } label: {
            if isRecording {
                Image(systemName: "mic.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.red, .primary)
            } else {
                Image(systemName: "person.badge.plus")
            }
        }
    }

    private func startCall() async {
        isRecording = true
        setupController.hide()
        overlayController.show(session: session) { Task { await stopCall() } }
        await callController.startCall(session: session)
    }

    private func stopCall() async {
        await callController.stopCall()
        overlayController.close()
        session.isRecording = false
        isRecording = false
        setupController.show()
    }
}
