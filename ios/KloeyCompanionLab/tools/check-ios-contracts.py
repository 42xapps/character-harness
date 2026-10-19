"""Offline contracts used by local native iOS builds and CI."""
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run(args):
    subprocess.run(args, cwd=ROOT, check=True)


run(['python3', 'tools/sync-player-helpers.py', '--check'])
with tempfile.TemporaryDirectory(prefix='kloey-contracts-') as directory:
    temp = Path(directory)
    generated = ['app_swift/Sources/Generated/HZMessages.swift', 'app_swift/Sources/Generated/HZEvents.swift']
    run(['swiftc', *generated, 'tools/check-text-command.swift', '-o', str(temp / 'text')])
    run([str(temp / 'text'), str(temp / 'request.bin')])
    run(['python3', 'tools/check-ios-bridge.py', str(temp / 'request.bin'), str(temp / 'ack.bin')])
    run([str(temp / 'text'), '--ack', str(temp / 'ack.bin')])
    run(['swiftc', generated[0], 'app_swift/Sources/CompanionProfile.swift',
         'tools/check-conversation-profile.swift', '-o', str(temp / 'profile')])
    run([str(temp / 'profile')])
    quality = (ROOT / 'app/src/app/ios_quality.h').read_text()
    enums = (ROOT / 'app/hz/src/engine/rendering/renderer_quality.h').read_text()
    strip = lambda text: re.sub(r'^#(?:include|pragma).*\n', '', text, flags=re.M)
    test = temp / 'quality.c'
    test.write_text('#include <stdint.h>\n#include <stdbool.h>\n#include <assert.h>\n'
                    'typedef uint32_t u32; typedef uint64_t u64; typedef float f32; typedef double f64; typedef uint32_t b32;\n' +
                    strip(enums) + strip(quality) + r'''
int main(void) {
  for (u32 h=0;h<4;h++) for(u32 t=0;t<4;t++) for(u32 power=0;power<2;power++) for(u32 visible=0;visible<2;visible++) {
    CompanionQuality p=companion_quality(t,power,visible,(RendererQuality)h);
    assert(p.level<=h && p.max_pixels>=360000 && p.max_pixels<=1350000);
    if(t>=2 || !visible) assert(p.level==RENDERER_QUALITY_LOW && !p.dynamic);
    if(!t && !power && visible) assert(p.dynamic && p.max_pixels==1350000 && p.level==h);
  }
}
''')
    run(['clang', '-std=c11', '-Wall', '-Wextra', '-Werror', str(test), '-o', str(temp / 'quality')])
    run([str(temp / 'quality')])
print('Quality policy: all thermal/power/visibility/hardware combinations passed.')
