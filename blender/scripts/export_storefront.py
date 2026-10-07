"""Staged web bake/export helpers for the CURRENT Blender instance.

Run individual functions from Blender's Text Editor/console. With connected MCP,
use explicit supported stage bodies, never exec() this helper file. Do not launch
another Blender. Wait for OBJECT_BAKE/RENDER jobs before advancing and inspect
numbered checkpoints between stages. The editable source scene and its data are
never modified by these helpers; all geometry/material edits target export copies.
"""
from array import array
import bmesh
import bpy
import math

SOURCE = 'Lantern Lane • storefront tour'
STAGE = 'WEB • Lantern Lane export'
GROUPS = ('learning', 'blog', 'about', 'projects', 'street', 'road', 'environment', 'foliage')
TEXTURE_GROUPS = tuple(group for group in GROUPS if group != 'foliage')
AWNING_CENTERS_YZ = ((-0.83, 3.73), (-1.015, 3.59), (-1.26, 3.395), (-1.445, 3.29))
AWNING_FACE_COUNT = 64


def stage():
    scene = bpy.data.scenes.get(STAGE)
    if scene is None or bpy.context.scene != scene:
        raise RuntimeError('Select the WEB export scene before running this stage.')
    if bpy.app.is_job_running('OBJECT_BAKE') or bpy.app.is_job_running('RENDER'):
        raise RuntimeError('Finish the active bake/render before changing the export scene.')
    return scene


def batch(scene, group):
    objects = [obj for obj in scene.objects if obj.type == 'MESH' and obj.get('_web_group') == group]
    assert len(objects) == 1, 'Batch this group first: ' + group
    return objects[0]


def select_only(obj):
    assert bpy.context.mode == 'OBJECT', 'Return to Object Mode before starting a stage.'
    for selected in bpy.context.selected_objects:
        selected.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def require_bake_geometry(scene):
    assert scene.get('export_stage') != 'web materials assigned', 'Bake with the original copied shaders, not the finished web materials.'
    assert all(batch(scene, group).get('_web_normals_repaired') for group in GROUPS), 'Repair all non-glass batches before baking.'
    assert all(batch(scene, group).get('_web_awning_faces_restored') == AWNING_FACE_COUNT for group in ('learning', 'about')), 'Restore both open striped awnings before baking.'


def source_display(scene):
    """Use the actual source look enum (AgX Medium High Contrast), never Raw HDR settings."""
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = scene['_web_bake_look']
    scene.view_settings.exposure = 0.5
    scene.view_settings.gamma = 1


def combined_settings(scene, group, samples):
    scene.render.bake.use_clear = True
    scene.render.bake.use_pass_diffuse = True
    scene.render.bake.use_pass_glossy = group != 'road'
    scene.render.bake.use_pass_transmission = False
    scene.render.bake.use_pass_emit = True
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = True
    scene.cycles.samples = samples


def prepare():
    """Copy evaluated visible geometry, materials, lights and world; no source edits."""
    source = bpy.data.scenes[SOURCE]
    assert bpy.context.scene == source
    assert STAGE not in bpy.data.scenes, 'An export is already in progress.'
    owners = {}

    def collect(collection, group, hidden=False):
        hidden = hidden or collection.hide_render or 'Construction' in collection.name or 'Asset Libraries' in collection.name
        if hidden:
            return
        for obj in collection.objects:
            if not obj.hide_render:
                owners[obj.name] = group
        for child in collection.children:
            collect(child, group, hidden)

    for collection in source.collection.children:
        group = {'01': 'learning', '02': 'blog', '03': 'about', '04': 'projects', '05': 'street', '06': 'environment'}.get(collection.name[:2])
        if group:
            collect(collection, group)
    target = bpy.data.scenes.new(STAGE)
    target.world = source.world.copy()
    target.render.engine = 'CYCLES'
    target.cycles.samples = 32
    target.cycles.max_bounces = 6
    target.cycles.diffuse_bounces = 3
    target.cycles.glossy_bounces = 2
    target.cycles.transmission_bounces = 4
    target.render.resolution_x = 800
    target.render.resolution_y = 600
    target.view_settings.view_transform = source.view_settings.view_transform
    target.view_settings.look = source.view_settings.look
    target.view_settings.exposure = source.view_settings.exposure
    target.view_settings.gamma = source.view_settings.gamma
    target['source_scene'] = source.name
    target['source_file'] = bpy.data.filepath
    target['export_seed'] = 42
    target['_web_bake_look'] = source.view_settings.look
    target.cycles.seed = 42
    materials = {}
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for original in list(source.objects):
        if original.name not in owners or original.type not in {'MESH', 'CURVE', 'FONT', 'LIGHT'}:
            continue
        group = owners[original.name]
        if original.type == 'LIGHT':
            obj = bpy.data.objects.new('WEB light • ' + original.name, original.data.copy())
        else:
            mesh = bpy.data.meshes.new_from_object(original.evaluated_get(depsgraph), preserve_all_data_layers=True, depsgraph=depsgraph)
            obj = bpy.data.objects.new('WEB • ' + original.name, mesh)
            for index, slot in enumerate(original.material_slots):
                material = slot.material
                if material:
                    if material.name not in materials:
                        materials[material.name] = material.copy()
                        materials[material.name].name = 'WEB source • ' + material.name
                    if index < len(mesh.materials):
                        mesh.materials[index] = materials[material.name]
                    else:
                        mesh.materials.append(materials[material.name])
            names = ' '.join(material.name for material in mesh.materials if material)
            if 'glass' in names.lower() and ('Clear shop' in names or 'clear reflective' in names):
                group = 'glass'
            elif 'Wet asphalt' in names:
                group = 'road'
            elif ('Botanical' in names and 'potting soil' not in names) or 'Leaves emerald' in names or 'succulent blue green' in names:
                group = 'foliage'
        target.collection.objects.link(obj)
        obj.matrix_world = original.matrix_world.copy()
        obj['_web_source'] = original.name
        obj['_web_owner'] = owners[original.name]
        obj['_web_group'] = group
    camera = bpy.data.objects.new('WEB • export camera', source.camera.data.copy())
    target.collection.objects.link(camera)
    camera.matrix_world = source.camera.matrix_world.copy()
    target.camera = camera
    bpy.context.window.scene = target
    return target


def preserve_coordinates():
    """Retain each source object's procedural coordinates before batching meshes."""
    scene = stage()
    materials = {material for obj in scene.objects if obj.type == 'MESH' for material in obj.data.materials if material}
    for obj in scene.objects:
        if obj.type != 'MESH' or obj.data.attributes.get('WEB_Generated') or not len(obj.data.vertices):
            continue
        mesh = obj.data
        low = [min(v.co[i] for v in mesh.vertices) for i in range(3)]
        high = [max(v.co[i] for v in mesh.vertices) for i in range(3)]
        generated = mesh.attributes.new('WEB_Generated', 'FLOAT_VECTOR', 'POINT')
        local = mesh.attributes.new('WEB_Object', 'FLOAT_VECTOR', 'POINT')
        generated.data.foreach_set('vector', [((v.co[i] - low[i]) / max(high[i] - low[i], 1e-8)) for v in mesh.vertices for i in range(3)])
        local.data.foreach_set('vector', [v.co[i] for v in mesh.vertices for i in range(3)])
    groups = {}
    visited = set()

    def convert_tree(tree):
        # Embedded material node trees share the name "Shader Nodetree"; identity
        # is essential here or all but the first material would be skipped.
        if tree in visited:
            return
        visited.add(tree)
        generated = next((node for node in tree.nodes if node.bl_idname == 'ShaderNodeAttribute' and node.attribute_name == 'WEB_Generated'), None)
        local = next((node for node in tree.nodes if node.bl_idname == 'ShaderNodeAttribute' and node.attribute_name == 'WEB_Object'), None)
        if generated is None:
            generated = tree.nodes.new('ShaderNodeAttribute')
            generated.attribute_name = 'WEB_Generated'
        if local is None:
            local = tree.nodes.new('ShaderNodeAttribute')
            local.attribute_name = 'WEB_Object'
        for node in list(tree.nodes):
            if node.bl_idname == 'ShaderNodeTexCoord':
                for link in list(node.outputs['Generated'].links):
                    tree.links.new(generated.outputs['Vector'], link.to_socket)
                if node.object is None:
                    for link in list(node.outputs['Object'].links):
                        tree.links.new(local.outputs['Vector'], link.to_socket)
            elif node.bl_idname in {'ShaderNodeTexNoise', 'ShaderNodeTexVoronoi', 'ShaderNodeTexWave', 'ShaderNodeTexGradient'}:
                if not node.inputs['Vector'].is_linked:
                    tree.links.new(generated.outputs['Vector'], node.inputs['Vector'])
            elif node.bl_idname == 'ShaderNodeGroup' and node.node_tree:
                original = node.node_tree
                if not original.name.startswith('WEB shader • '):
                    if original not in groups:
                        groups[original] = original.copy()
                        groups[original].name = 'WEB shader • ' + original.name
                    node.node_tree = groups[original]
                convert_tree(node.node_tree)

    for material in materials:
        if material.use_nodes:
            convert_tree(material.node_tree)
            material['_web_coordinates'] = True


def reduce_foliage(ratio=0.16):
    """Simplify only the derived, dense curved leaves; never the editable plants."""
    scene = stage()
    for obj in scene.objects:
        if obj.type == 'MESH' and obj.get('_web_group') == 'foliage' and not obj.get('_web_reduced'):
            modifier = obj.modifiers.new('Web leaf LOD', 'DECIMATE')
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in list(scene.objects):
        if obj.type == 'MESH' and obj.get('_web_group') == 'foliage' and not obj.get('_web_reduced'):
            mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph), preserve_all_data_layers=True, depsgraph=depsgraph)
            obj.modifiers.clear()
            obj.data = mesh
            obj['_web_reduced'] = ratio


def batch_group(group, unwrap=None):
    scene = stage()
    if unwrap is None:
        unwrap = group not in {'glass', 'foliage'}
    objects = [o for o in scene.objects if o.type == 'MESH' and o.get('_web_group') == group]
    assert objects
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'WEB batch • ' + group
    obj['_web_group'] = group
    if unwrap:
        if not obj.data.uv_layers.get('WEB_UV'):
            obj.data.uv_layers.new(name='WEB_UV')
        obj.data.uv_layers.active_index = list(obj.data.uv_layers.keys()).index('WEB_UV')
        obj.data.uv_layers.active.active_render = True
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(75), island_margin=0.0015, area_weight=1.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    return obj


def repair_normals(group):
    """Repair inward source cube normals on a derived batch only; never touch glass."""
    scene = stage()
    assert group in GROUPS, 'Glass keeps its authored normals; only repair non-glass bake groups.'
    assert not any(scene.get('baked_' + item) for item in GROUPS), 'Repair the complete scene before baking any illumination.'
    obj = batch(scene, group)
    if obj.get('_web_normals_repaired'):
        return obj
    select_only(obj)
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bpy.ops.object.mode_set(mode='EDIT')
    try:
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
    finally:
        bpy.ops.object.mode_set(mode='OBJECT')
    obj['_web_normals_repaired'] = True
    return obj


def restore_awning_faces(group):
    """Global outward recalc reverses open cloth: restore its 64 upward faces per shop.

    Centers below are in Blender WORLD Y/Z, not exported glTF Y-up coordinates.
    Match before editing, so a changed source fails visibly instead of guessing.
    """
    scene = stage()
    assert group in {'learning', 'about'}
    assert not any(scene.get('baked_' + item) for item in GROUPS), 'Restore cloth before all lighting bakes.'
    obj = batch(scene, group)
    assert obj.get('_web_normals_repaired'), 'Run repair_normals(group) first.'
    if obj.get('_web_awning_faces_restored') == AWNING_FACE_COUNT:
        return AWNING_FACE_COUNT
    mesh = bmesh.new()
    try:
        mesh.from_mesh(obj.data)
        mesh.normal_update()
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        faces = []
        for face in mesh.faces:
            center = obj.matrix_world @ face.calc_center_median()
            normal = (normal_matrix @ face.normal).normalized()
            if face.calc_area() <= 0.01 or normal.z >= 0:
                continue
            if any(abs(center.y - y) <= 0.001 and abs(center.z - z) <= 0.007 for y, z in AWNING_CENTERS_YZ):
                faces.append(face)
        assert len(faces) == AWNING_FACE_COUNT, 'Expected 64 open awning faces for %s, found %s; inspect the export checkpoint.' % (group, len(faces))
        for face in faces:
            face.normal_flip()
        mesh.normal_update()
        mesh.to_mesh(obj.data)
        obj.data.update()
    finally:
        mesh.free()
    obj['_web_awning_faces_restored'] = AWNING_FACE_COUNT
    return AWNING_FACE_COUNT


def bake_group(group, resolution=2048, samples=32):
    """Bake one of seven image groups; foliage uses bake_foliage_vertex() instead."""
    scene = stage()
    assert group in TEXTURE_GROUPS, 'Foliage uses POINT vertex lighting, not an atlas.'
    require_bake_geometry(scene)
    obj = batch(scene, group)
    assert obj.data.uv_layers.get('WEB_UV'), 'Create the explicit WEB_UV bake layer first.'
    obj.data.uv_layers.active_index = list(obj.data.uv_layers.keys()).index('WEB_UV')
    obj.data.uv_layers.active.active_render = True
    select_only(obj)
    image = bpy.data.images.get('WEB bake • ' + group)
    if image is None:
        image = bpy.data.images.new('WEB bake • ' + group, width=resolution, height=resolution, alpha=False, float_buffer=True)
    elif tuple(image.size) != (resolution, resolution):
        image.scale(resolution, resolution)
    image.colorspace_settings.name = 'Linear Rec.709'
    for material in obj.data.materials:
        if not material or not material.use_nodes:
            continue
        node = material.node_tree.nodes.get('WEB_BAKE_TARGET')
        if node is None:
            node = material.node_tree.nodes.new('ShaderNodeTexImage')
            node.name = 'WEB_BAKE_TARGET'
        node.image = image
        material.node_tree.nodes.active = node
    scene.render.bake.target = 'IMAGE_TEXTURES'
    scene.render.bake.margin = 4
    scene.render.bake.margin_type = 'EXTEND'
    combined_settings(scene, group, samples)
    scene['baked_' + group] = False
    scene['baking_group'] = group
    return bpy.ops.object.bake('INVOKE_DEFAULT', type='COMBINED', uv_layer='WEB_UV')


def save_bake(group):
    scene = stage()
    assert group in TEXTURE_GROUPS
    assert scene.get('baking_group') == group, 'Save the completed active image bake before advancing.'
    source_display(scene)
    image = bpy.data.images['WEB bake • ' + group]
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    image.save_render(bpy.path.abspath('//../renders/web-export/' + group + '.png'), scene=scene)
    image.filepath_raw = bpy.path.abspath('//../renders/web-export/' + group + '-linear.exr')
    image.file_format = 'OPEN_EXR'
    image.save()
    scene['baked_' + group] = True
    scene['baking_group'] = ''


def bake_foliage_vertex(samples=32):
    """Bake dense leaves to POINT float colors; no foliage UV unwrap/atlas is required."""
    scene = stage()
    require_bake_geometry(scene)
    obj = batch(scene, 'foliage')
    select_only(obj)
    color = obj.data.color_attributes.get('WEB_Light')
    if color is None:
        color = obj.data.color_attributes.new(name='WEB_Light', type='FLOAT_COLOR', domain='POINT')
    assert color.domain == 'POINT' and color.data_type == 'FLOAT_COLOR'
    obj.data.color_attributes.active_color = color
    scene.render.bake.target = 'VERTEX_COLORS'
    combined_settings(scene, 'foliage', samples)
    scene['baking_group'] = 'foliage_vertex'
    scene['baked_foliage_vertex'] = False
    scene['baked_foliage'] = False
    obj['_web_vertex_display_toned'] = False
    return bpy.ops.object.bake('INVOKE_DEFAULT', type='COMBINED')


def save_foliage_vertex():
    """After bake completion, convert linear illumination to display-toned linear COLOR_0.

    Blender image pixels are bottom-left ordered both when packing and reading;
    do not flip rows. Non-Color reads the display PNG's encoded values unchanged,
    which are then explicitly sRGB-decoded for glTF's linear vertex colors.
    """
    scene = stage()
    assert scene.get('baking_group') == 'foliage_vertex'
    obj = batch(scene, 'foliage')
    assert not obj.get('_web_vertex_display_toned'), 'Never apply the display transform twice.'
    color = obj.data.color_attributes['WEB_Light']
    count = len(color.data)
    assert count > 0 and color.domain == 'POINT' and color.data_type == 'FLOAT_COLOR'
    scene.render.bake.target = 'IMAGE_TEXTURES'
    source_display(scene)
    width = 1024
    height = math.ceil(count / width)
    linear = array('f', [0.0]) * (count * 4)
    color.data.foreach_get('color', linear)
    pixels = array('f', [0.0]) * (width * height * 4)
    pixels[:len(linear)] = linear
    image = bpy.data.images.new('WEB foliage • linear illumination', width=width, height=height, alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Linear Rec.709'
    image.pixels.foreach_set(pixels)
    image.update()
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    path = bpy.path.abspath('//../renders/web-export/foliage-vertex-display.png')
    image.save_render(path, scene=scene)
    display = bpy.data.images.load(path, check_existing=False)
    display.colorspace_settings.name = 'Non-Color'
    display.pixels.foreach_get(pixels)
    for index in range(count):
        offset = index * 4
        for channel in range(3):
            value = pixels[offset + channel]
            linear[offset + channel] = value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        linear[offset + 3] = 1.0
    color.data.foreach_set('color', linear)
    obj.data.update()
    obj['_web_vertex_display_toned'] = True
    scene['baked_foliage_vertex'] = True
    scene['baked_foliage'] = True
    scene['baking_group'] = ''


def bake_road_maps():
    """Retain the authored wet-road bump and roughness for live reflections."""
    scene = stage()
    require_bake_geometry(scene)
    assert scene.get('baked_road'), 'Save the corrected combined road bake before its data maps.'
    obj = batch(scene, 'road')
    select_only(obj)
    obj.data.uv_layers.active_index = list(obj.data.uv_layers.keys()).index('WEB_UV')
    obj.data.uv_layers.active.active_render = True
    scene.render.bake.target = 'IMAGE_TEXTURES'
    scene.cycles.samples = 32
    scene['baked_road_data'] = False
    for kind in ['NORMAL', 'ROUGHNESS']:
        image = bpy.data.images.new('WEB road • ' + kind.lower(), width=1024, height=1024, alpha=False, float_buffer=True)
        image.colorspace_settings.name = 'Non-Color'
        for material in obj.data.materials:
            node = material.node_tree.nodes.get('WEB_BAKE_TARGET')
            node.image = image
            material.node_tree.nodes.active = node
        result = bpy.ops.object.bake(type=kind, normal_space='TANGENT', uv_layer='WEB_UV')
        assert 'FINISHED' in result
        image.file_format = 'PNG'
        image.filepath_raw = bpy.path.abspath('//../renders/web-export/road-' + kind.lower() + '.png')
        # Data maps must bypass the AgX display transform.
        image.save()
    scene['baked_road_data'] = True


def capture_environment():
    """Capture linear reflections only AFTER all bakes, BEFORE replacing source shaders."""
    scene = stage()
    require_bake_geometry(scene)
    assert all(scene.get('baked_' + group) for group in GROUPS)
    assert scene.get('baked_foliage_vertex') and scene.get('baked_road_data')
    if not scene.get('_web_overview_camera'):
        scene['_web_overview_camera'] = scene.camera.name
        scene['_web_overview_resolution'] = [scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage]
    camera = scene.objects.get(scene.get('_web_environment_camera', ''))
    if camera is None:
        data = bpy.data.cameras.new('WEB reflection capture')
        data.type = 'PANO'
        data.panorama_type = 'EQUIRECTANGULAR'
        camera = bpy.data.objects.new('WEB reflection capture', data)
        scene.collection.objects.link(camera)
        camera.location = (0, -3, 2)
        camera.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
        scene['_web_environment_camera'] = camera.name
    scene.camera = camera
    scene.render.resolution_x = 512
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = 'Raw'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.image_settings.file_format = 'HDR'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.filepath = bpy.path.abspath('//../renders/web-export/environment.hdr')
    scene['_web_environment_saved'] = False
    return bpy.ops.render.render('INVOKE_DEFAULT', write_still=True)


def finish_environment():
    """After checking the completed HDR, restore the actual overview camera."""
    scene = stage()
    path = bpy.path.abspath('//../renders/web-export/environment.hdr')
    probe = bpy.data.images.load(path, check_existing=False)
    try:
        assert tuple(probe.size) == (512, 256), 'Verify the new 512×256 HDR render before advancing.'
    finally:
        bpy.data.images.remove(probe)
    scene.camera = scene.objects[scene['_web_overview_camera']]
    width, height, percentage = scene['_web_overview_resolution']
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = percentage
    source_display(scene)
    scene['_web_environment_saved'] = True


def finish_materials():
    scene = stage()
    assert all(scene.get('baked_' + group) for group in GROUPS)
    assert scene.get('baked_foliage_vertex') and scene.get('baked_road_data')
    assert scene.get('_web_environment_saved'), 'Verify the completed HDR and run finish_environment() first.'
    scene.camera = scene.objects[scene['_web_overview_camera']]
    for group in TEXTURE_GROUPS:
        obj = batch(scene, group)
        image = bpy.data.images.load(bpy.path.abspath('//../renders/web-export/' + group + '.png'), check_existing=False)
        image.colorspace_settings.name = 'sRGB'
        material = bpy.data.materials.new(('WEB reflective • ' if group == 'road' else 'WEB baked • ') + group)
        material.use_nodes = True
        material.node_tree.nodes.clear()
        output = material.node_tree.nodes.new('ShaderNodeOutputMaterial')
        texture = material.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        uv = material.node_tree.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'WEB_UV'
        material.node_tree.links.new(uv.outputs['UV'], texture.inputs['Vector'])
        if group == 'road':
            shader = material.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
            shader.inputs['Base Color'].default_value = (0, 0, 0, 1)
            shader.inputs['Roughness'].default_value = 0.23
            shader.inputs['Emission Strength'].default_value = 1
            material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Emission Color'])
            for kind in ['normal', 'roughness']:
                data_image = bpy.data.images.load(bpy.path.abspath('//../renders/web-export/road-' + kind + '.png'), check_existing=False)
                data_image.colorspace_settings.name = 'Non-Color'
                data_texture = material.node_tree.nodes.new('ShaderNodeTexImage')
                data_texture.image = data_image
                material.node_tree.links.new(uv.outputs['UV'], data_texture.inputs['Vector'])
                if kind == 'normal':
                    normal = material.node_tree.nodes.new('ShaderNodeNormalMap')
                    normal.uv_map = 'WEB_UV'
                    material.node_tree.links.new(data_texture.outputs['Color'], normal.inputs['Color'])
                    material.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])
                else:
                    material.node_tree.links.new(data_texture.outputs['Color'], shader.inputs['Roughness'])
        else:
            shader = material.node_tree.nodes.new('ShaderNodeEmission')
            shader.inputs['Strength'].default_value = 1
            material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Color'])
        material.node_tree.links.new(shader.outputs[0], output.inputs['Surface'])
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.material_index = 0
        for layer in list(obj.data.uv_layers):
            if layer.name != 'WEB_UV':
                obj.data.uv_layers.remove(layer)
        for name in ['WEB_Generated', 'WEB_Object']:
            attribute = obj.data.attributes.get(name)
            if attribute:
                obj.data.attributes.remove(attribute)
    obj = batch(scene, 'foliage')
    color = obj.data.color_attributes['WEB_Light']
    assert color.domain == 'POINT' and color.data_type == 'FLOAT_COLOR'
    assert obj.get('_web_vertex_display_toned'), 'Convert the completed foliage bake before assigning its material.'
    material = bpy.data.materials.new('WEB baked vertex • foliage')
    material.use_nodes = True
    material.node_tree.nodes.clear()
    output = material.node_tree.nodes.new('ShaderNodeOutputMaterial')
    vertex = material.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'WEB_Light'
    emission = material.node_tree.nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1
    material.node_tree.links.new(vertex.outputs['Color'], emission.inputs['Color'])
    material.node_tree.links.new(emission.outputs['Emission'], output.inputs['Surface'])
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
    for layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(layer)
    for name in ['WEB_Generated', 'WEB_Object']:
        attribute = obj.data.attributes.get(name)
        if attribute:
            obj.data.attributes.remove(attribute)
    # Reacquire the attribute after removing other CustomData layers.
    obj.data.color_attributes.active_color = obj.data.color_attributes['WEB_Light']
    obj.data.color_attributes.render_color_index = 0

    glass = bpy.data.materials.new('WEB glass')
    glass.use_nodes = True
    shader = glass.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (0.72, 0.84, 1, 1)
    shader.inputs['Roughness'].default_value = 0.16
    shader.inputs['Alpha'].default_value = 0.10
    glass.surface_render_method = 'DITHERED'
    obj = batch(scene, 'glass')
    obj.data.materials.clear()
    obj.data.materials.append(glass)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
    # The image/vertex bakes already include the source display treatment.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene['export_stage'] = 'web materials assigned'


def export_glb():
    scene = stage()
    assert scene.get('export_stage') == 'web materials assigned'
    for obj in scene.objects:
        obj.select_set(obj.type == 'MESH')
    return bpy.ops.export_scene.gltf(
        filepath=bpy.path.abspath('//../renders/web-export/lantern-lane.baked.glb'),
        export_format='GLB', use_selection=True, use_active_scene=True,
        export_apply=True, export_animations=False, export_cameras=False,
        export_lights=False, export_extras=False, export_attributes=False,
        export_yup=True, export_materials='EXPORT', export_image_format='AUTO',
        # MATERIAL (the default) misses VertexColor -> Emission; ACTIVE is required.
        export_vertex_color='ACTIVE', export_normals=True, export_tangents=True
    )


# Deliberately no automatic work or exec()-based MCP entrypoint.
# 1. Save a numbered safety checkpoint; prepare(), preserve_coordinates().
# 2. reduce_foliage(); batch_group() for GROUPS + glass (foliage/glass skip UVs).
# 3. repair_normals() for GROUPS, then restore_awning_faces() for learning/about.
#    Inspect both 64-face cloth corrections and save a geometry checkpoint.
# 4. bake_group()/save_bake() for TEXTURE_GROUPS, one completed job at a time.
# 5. bake_foliage_vertex(), wait, save_foliage_vertex(); bake_road_maps().
#    Verify all eight baked_* statuses plus foliage_vertex/road_data; checkpoint.
# 6. capture_environment(), wait/inspect HDR, finish_environment(); checkpoint.
# 7. finish_materials(), inspect the Standard preview, export_glb(); checkpoint.
# Only the reflective road needs tangent data; unlit tangent warnings concern
# normals discarded during optimization, not missing baked lighting.
# Keep copied source shaders until ALL bakes/HDR finish. Return the UI to SOURCE
# when done; never save the derivative over the canonical source .blend.
