"""Run with Blender --background --factory-startup --python tools/prepare-forest.py."""
from pathlib import Path
import json
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
source = root / "art/forest/WalkInTheWoods.source.glb"
output = root / "app/assets/environments/walk_in_the_woods/forest.glb"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))

removed = []
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        continue
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    xs = [p.x for p in points]
    zs = [-p.y for p in points]  # Blender Z-up to glTF Y-up.
    terrain = max(xs) - min(xs) > 1 and max(zs) - min(zs) > 1
    if not terrain and max(zs) > 0.60 and min(xs) < 0.09 and max(xs) > -0.09:
        removed.append(obj.name)
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
bpy.context.object.name = "Forest"
bpy.ops.wm.save_as_mainfile(filepath=str(root / "art/forest/forest.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(output), export_format="GLB", use_selection=True,
    export_yup=True, export_apply=True, export_materials="EXPORT",
    export_cameras=False, export_lights=False,
)
(root / "art/forest/preparation.json").write_text(json.dumps({
    "source": "Walk in the Woods by Don Carson, CC BY 3.0",
    "removed_foreground_objects": removed,
    "remaining_source_meshes": len(meshes),
    "exported_objects": 1,
    "stage_scale": 14,
    "standing_point_in_source": [0.1, -0.09469, 0.55],
}, indent=2) + "\n")
