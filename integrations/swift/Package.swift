// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "QoreSentinelQoreChain",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [.library(name: "QoreSentinelQoreChain", targets: ["QoreSentinelQoreChain"])],
    dependencies: [
        .package(url: "https://github.com/qorechain/qoresign", from: "0.2.0"),
        .package(url: "https://github.com/qorechain/qoreseal", from: "0.1.0")
    ],
    targets: [.target(name: "QoreSentinelQoreChain", dependencies: ["QoreSign", "QoreSeal"])]
)
