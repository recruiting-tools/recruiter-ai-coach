// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CallTips",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "CallTips",
            path: "Sources/CallTips"
        )
    ]
)
