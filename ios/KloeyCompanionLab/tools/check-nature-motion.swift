import AppKit
precondition(CommandLine.arguments.count == 3, "Supply two 414 x 900 fixed-camera preview captures")
let a = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))!
let b = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])))!
precondition(a.pixelsWide == 414 && a.pixelsHigh == 900 && b.pixelsWide == 414 && b.pixelsHigh == 900)
// Patches exclude the avatar and its moving shadow in the default portrait view.
func changed(_ xs: Range<Int>, _ ys: Range<Int>) -> Int {
    var count = 0
    for y in ys { for x in xs {
        let ca = a.colorAt(x: x, y: y)!.usingColorSpace(.deviceRGB)!
        let cb = b.colorAt(x: x, y: y)!.usingColorSpace(.deviceRGB)!
        if abs(ca.redComponent-cb.redComponent) + abs(ca.greenComponent-cb.greenComponent) + abs(ca.blueComponent-cb.blueComponent) > 0.02 { count += 1 }
    }}
    return count
}
let ground = changed(170..<245, 840..<890)
let leaves = changed(0..<100, 60..<240)
let flowers = changed(335..<410, 470..<720)
print("Fixed ground pixels changed: \(ground) / 3750")
print("Tree foliage pixels changed: \(leaves) / 18000")
print("Flowers/grass pixels changed: \(flowers) / 18750")
precondition(ground == 0, "Ground should be static")
precondition(leaves > 0 && flowers > 0, "Vegetation should animate")
