# Retargeting provenance

The offline locomotion tool now imports `runtime/src/rig/{glb,humanoid,math,retarget}.ts`
from this repository directly. This removes four drifting copies. The original
Apache 2.0 license is retained here; the repository license also applies.
This code is used for asset preparation and is not bundled as TypeScript in iOS.
