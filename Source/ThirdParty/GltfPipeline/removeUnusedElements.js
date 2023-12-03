import ForEach from "./ForEach.js"
import forEachTextureInMaterial from "./forEachTextureInMaterial.js"
import usesExtension from "./usesExtension.js"
import defaultValue from "../../Core/defaultValue.js"
import defined from "../../Core/defined.js"

var allElementTypes = ['mesh', 'node', 'material', 'accessor', 'bufferView', 'buffer', 'texture', 'sampler', 'image'];

/**
 * Removes unused elements from gltf.
 *
 * @param {Object} gltf A javascript object containing a glTF asset.
 * @param {String[]} [elementTypes=['mesh', 'node', 'material', 'accessor', 'bufferView', 'buffer']] Element types to be removed. Needs to be a subset of ['mesh', 'node', 'material', 'accessor', 'bufferView', 'buffer'], other items will be ignored.
 *
 * @private
 */
function removeUnusedElements(gltf, elementTypes) {
    elementTypes = defaultValue(elementTypes, allElementTypes);
    allElementTypes.forEach(function(type) {
        if (elementTypes.indexOf(type) > -1) {
            removeUnusedElementsByType(gltf, type);
        }
    });
    return gltf;
}

var TypeToGltfElementName = {
    accessor: 'accessors',
    buffer: 'buffers',
    bufferView: 'bufferViews',
    image: 'images',
    node: 'nodes',
    material: 'materials',
    mesh: 'meshes',
    sampler: 'samplers',
    texture: 'textures'
};

function removeUnusedElementsByType(gltf, type) {
    var name = TypeToGltfElementName[type];
    var arrayOfObjects = gltf[name];

    if (defined(arrayOfObjects)) {
        var removed = 0;
        var usedIds = getListOfElementsIdsInUse[type](gltf);
        var length = arrayOfObjects.length;

        for (var i = 0; i < length; ++i) {
            if (!usedIds[i]) {
                Remove[type](gltf, i - removed);
                removed++;
            }
        }
    }
}

/**
 * Contains functions for removing elements from a glTF hierarchy.
 * Since top-level glTF elements are arrays, when something is removed, referring
 * indices need to be updated.
 * @constructor
 *
 * @private
 */
function Remove() {}

Remove.accessor = function(gltf, accessorId) {
    var accessors = gltf.accessors;

    accessors.splice(accessorId, 1);

    ForEach.mesh(gltf, function(mesh) {
        ForEach.meshPrimitive(mesh, function(primitive) {
            // Update accessor ids for the primitives.
            ForEach.meshPrimitiveAttribute(primitive, function(attributeAccessorId, semantic) {
                if (attributeAccessorId > accessorId) {
                    primitive.attributes[semantic]--;
                }
            });

            // Update accessor ids for the targets.
            ForEach.meshPrimitiveTarget(primitive, function(target) {
                ForEach.meshPrimitiveTargetAttribute(target, function(attributeAccessorId, semantic) {
                    if (attributeAccessorId > accessorId) {
                        target[semantic]--;
                    }
                });
            });
            var indices = primitive.indices;
            if (defined(indices) && indices > accessorId) {
                primitive.indices--;
            }
        });
    });

    ForEach.skin(gltf, function(skin) {
        if (defined(skin.inverseBindMatrices) && skin.inverseBindMatrices > accessorId) {
            skin.inverseBindMatrices--;
        }
    });

    ForEach.animation(gltf, function(animation) {
        ForEach.animationSampler(animation, function(sampler) {
            if (defined(sampler.input) && sampler.input > accessorId) {
                sampler.input--;
            }
            if (defined(sampler.output) && sampler.output > accessorId) {
                sampler.output--;
            }
        });
    });
};

Remove.buffer = function(gltf, bufferId) {
    var buffers = gltf.buffers;

    buffers.splice(bufferId, 1);

    ForEach.bufferView(gltf, function(bufferView) {
        if (defined(bufferView.buffer) && bufferView.buffer > bufferId) {
            bufferView.buffer--;
        }
    });
};

Remove.bufferView = function(gltf, bufferViewId) {
    var bufferViews = gltf.bufferViews;

    bufferViews.splice(bufferViewId, 1);

    ForEach.accessor(gltf, function(accessor) {
        if (defined(accessor.bufferView) && accessor.bufferView > bufferViewId) {
            accessor.bufferView--;
        }
    });

    ForEach.shader(gltf, function(shader) {
        if (defined(shader.bufferView) && shader.bufferView > bufferViewId) {
            shader.bufferView--;
        }
    });

    ForEach.image(gltf, function(image) {
        if (defined(image.bufferView) && image.bufferView > bufferViewId) {
            image.bufferView--;
        }
    });

    if (usesExtension(gltf, 'KHR_draco_mesh_compression')) {
        ForEach.mesh(gltf, function(mesh) {
            ForEach.meshPrimitive(mesh, function(primitive) {
                if (defined(primitive.extensions) &&
                    defined(primitive.extensions.KHR_draco_mesh_compression)) {
                    if (primitive.extensions.KHR_draco_mesh_compression.bufferView > bufferViewId) {
                        primitive.extensions.KHR_draco_mesh_compression.bufferView--;
                    }
                }
            });
        });
    }

    if (usesExtension(gltf, 'EXT_feature_metadata')) {
        var extension = gltf.extensions.EXT_feature_metadata;
        var featureTables = extension.featureTables;
        for (var featureTableId in featureTables) {
            if (featureTables.hasOwnProperty(featureTableId)) {
                var featureTable = featureTables[featureTableId];
                var properties = featureTable.properties;
                if (defined(properties)) {
                    for (var propertyId in properties) {
                        if (properties.hasOwnProperty(propertyId)) {
                            var property = properties[propertyId];
                            if (defined(property.bufferView) && property.bufferView > bufferViewId) {
                                property.bufferView--;
                            }
                            if (defined(property.arrayOffsetBufferView) && property.arrayOffsetBufferView > bufferViewId) {
                                property.arrayOffsetBufferView--;
                            }
                            if (defined(property.stringOffsetBufferView) && property.stringOffsetBufferView > bufferViewId) {
                                property.stringOffsetBufferView--;
                            }
                        }
                    }
                }
            }
        }
    }
};

Remove.image = function(gltf, imageId) {
    var images = gltf.images;
    images.splice(imageId, 1);

    ForEach.texture(gltf, function (texture) {
        if (defined(texture.source)) {
            if (texture.source > imageId) {
                --texture.source;
            }
        }
        var ext = texture.extensions;
        if (defined(ext) && defined(ext.EXT_texture_webp) && ext.EXT_texture_webp.source > imageId) {
            --texture.extensions.EXT_texture_webp.source;
        } else if (defined(ext) && defined(ext.KHR_texture_basisu) && ext.KHR_texture_basisu.source > imageId) {
            --texture.extensions.KHR_texture_basisu.source;
        }
    });
};

Remove.mesh = function(gltf, meshId) {
    var meshes = gltf.meshes;
    meshes.splice(meshId, 1);

    ForEach.node(gltf, function(node) {
        if (defined(node.mesh)) {
            if (node.mesh > meshId) {
                node.mesh--;
            } else if (node.mesh === meshId) {
                // Remove reference to deleted mesh
                delete node.mesh;
            }
        }
    });
};

Remove.node = function(gltf, nodeId) {
    var nodes = gltf.nodes;
    nodes.splice(nodeId, 1);

    // Shift all node references
    ForEach.skin(gltf, function(skin) {
        if (defined(skin.skeleton) && skin.skeleton > nodeId) {
            skin.skeleton--;
        }

        skin.joints = skin.joints.map(function(x) {
            return x > nodeId ? x - 1 : x;
        });
    });
    ForEach.animation(gltf, function(animation) {
        ForEach.animationChannel(animation, function(channel) {
            if (defined(channel.target) && defined(channel.target.node) && (channel.target.node > nodeId)) {
                channel.target.node--;
            }
        });
    });
    ForEach.technique(gltf, function(technique) {
        ForEach.techniqueUniform(technique, function(uniform) {
            if (defined(uniform.node) && uniform.node > nodeId) {
                uniform.node--;
            }
        });
    });
    ForEach.node(gltf, function(node) {
        if (!defined(node.children)) {
            return;
        }

        node.children = node.children
            .filter(function(x) {
                return x !== nodeId; // Remove
            })
            .map(function(x) {
                return x > nodeId ? x - 1 : x; // Shift indices
            });
    });
    ForEach.scene(gltf, function(scene) {
        scene.nodes = scene.nodes
            .filter(function(x) {
                return x !== nodeId; // Remove
            })
            .map(function(x) {
                return x > nodeId ? x - 1 : x; // Shift indices
            });
    });
};

Remove.material = function(gltf, materialId) {
    var materials = gltf.materials;
    materials.splice(materialId, 1);

    // Shift other material ids
    ForEach.mesh(gltf, function(mesh) {
        ForEach.meshPrimitive(mesh, function(primitive) {
            if (defined(primitive.material) && primitive.material > materialId) {
                primitive.material--;
            }
        });
    });
};

Remove.sampler = function(gltf, samplerId) {
    var samplers = gltf.samplers;
    samplers.splice(samplerId, 1);

    ForEach.texture(gltf, function (texture) {
        if (defined(texture.sampler)) {
            if (texture.sampler > samplerId) {
                --texture.sampler;
            }
        }
    });
};

Remove.texture = function(gltf, textureId) {
    var textures = gltf.textures;
    textures.splice(textureId, 1);

    ForEach.material(gltf, function (material) {
        forEachTextureInMaterial(material, function (textureIndex, textureInfo) {
            if (textureInfo.index > textureId) {
                --textureInfo.index;
            }
        });
    });

    if (usesExtension(gltf, 'EXT_feature_metadata')) {
        ForEach.mesh(gltf, function(mesh) {
            ForEach.meshPrimitive(mesh, function(primitive) {
                var extensions = primitive.extensions;
                if (defined(extensions) && defined(extensions.EXT_feature_metadata)) {
                    var extension = extensions.EXT_feature_metadata;
                    var featureIdTextures = extension.featureIdTextures;
                    if (defined(featureIdTextures)) {
                        var featureIdTexturesLength = featureIdTextures.length;
                        for (var i = 0; i < featureIdTexturesLength; ++i) {
                            var featureIdTexture = featureIdTextures[i];
                            var textureInfo = featureIdTexture.featureIds.texture;
                            if (textureInfo.index > textureId) {
                                --textureInfo.index;
                            }
                        }
                    }
                }
            });
        });

        var extension = gltf.extensions.EXT_feature_metadata;
        var featureTextures = extension.featureTextures;
        for (var featureTextureId in featureTextures) {
            if (featureTextures.hasOwnProperty(featureTextureId)) {
                var featureTexture = featureTextures[featureTextureId];
                var properties = featureTexture.properties;
                if (defined(properties)) {
                    for (var propertyId in properties) {
                        if (properties.hasOwnProperty(propertyId)) {
                            var property = properties[propertyId];
                            var textureInfo = property.texture;
                            if (textureInfo.index > textureId) {
                                --textureInfo.index;
                            }
                        }
                    }
                }
            }
        }
    }
};

/**
 * Contains functions for getting a list of element ids in use by the glTF asset.
 * @constructor
 *
 * @private
 */
function getListOfElementsIdsInUse() {}

getListOfElementsIdsInUse.accessor = function(gltf) {
    // Calculate accessor's that are currently in use.
    var usedAccessorIds = {};

    ForEach.mesh(gltf, function(mesh) {
        ForEach.meshPrimitive(mesh, function(primitive) {
            ForEach.meshPrimitiveAttribute(primitive, function(accessorId) {
                usedAccessorIds[accessorId] = true;
            });
            ForEach.meshPrimitiveTarget(primitive, function(target) {
                ForEach.meshPrimitiveTargetAttribute(target, function(accessorId) {
                    usedAccessorIds[accessorId] = true;
                });
            });
            var indices = primitive.indices;
            if (defined(indices)) {
                usedAccessorIds[indices] = true;
            }
        });
    });

    ForEach.skin(gltf, function(skin) {
        if (defined(skin.inverseBindMatrices)) {
            usedAccessorIds[skin.inverseBindMatrices] = true;
        }
    });

    ForEach.animation(gltf, function(animation) {
        ForEach.animationSampler(animation, function(sampler) {
            if (defined(sampler.input)) {
                usedAccessorIds[sampler.input] = true;
            }
            if (defined(sampler.output)) {
                usedAccessorIds[sampler.output] = true;
            }
        });
    });

    if (usesExtension(gltf, 'EXT_mesh_gpu_instancing')) {
        ForEach.node(gltf, function(node) {
            if (defined(node.extensions) && defined(node.extensions.EXT_mesh_gpu_instancing)) {
                Object.keys(node.extensions.EXT_mesh_gpu_instancing.attributes).forEach(function(key) {
                    var attributeAccessorId = node.extensions.EXT_mesh_gpu_instancing.attributes[key];
                    usedAccessorIds[attributeAccessorId] = true;
                });
            }
        });
    }

    return usedAccessorIds;
};

getListOfElementsIdsInUse.buffer = function(gltf) {
    // Calculate buffer's that are currently in use.
    var usedBufferIds = {};

    ForEach.bufferView(gltf, function(bufferView) {
        if (defined(bufferView.buffer)) {
            usedBufferIds[bufferView.buffer] = true;
        }
    });

    return usedBufferIds;
};

getListOfElementsIdsInUse.bufferView = function(gltf) {
    // Calculate bufferView's that are currently in use.
    var usedBufferViewIds = {};

    ForEach.accessor(gltf, function(accessor) {
        if (defined(accessor.bufferView)) {
            usedBufferViewIds[accessor.bufferView] = true;
        }
    });

    ForEach.shader(gltf, function(shader) {
        if (defined(shader.bufferView)) {
            usedBufferViewIds[shader.bufferView] = true;
        }
    });

    ForEach.image(gltf, function(image) {
        if (defined(image.bufferView)) {
            usedBufferViewIds[image.bufferView] = true;
        }
    });

    if (usesExtension(gltf, 'KHR_draco_mesh_compression')) {
        ForEach.mesh(gltf, function(mesh) {
            ForEach.meshPrimitive(mesh, function(primitive) {
                if (defined(primitive.extensions) &&
                    defined(primitive.extensions.KHR_draco_mesh_compression)) {
                    usedBufferViewIds[primitive.extensions.KHR_draco_mesh_compression.bufferView] = true;
                }
            });
        });
    }

    if (usesExtension(gltf, 'EXT_feature_metadata')) {
        var extension = gltf.extensions.EXT_feature_metadata;
        var featureTables = extension.featureTables;
        for (var featureTableId in featureTables) {
            if (featureTables.hasOwnProperty(featureTableId)) {
                var featureTable = featureTables[featureTableId];
                var properties = featureTable.properties;
                if (defined(properties)) {
                    for (var propertyId in properties) {
                        if (properties.hasOwnProperty(propertyId)) {
                            var property = properties[propertyId];
                            if (defined(property.bufferView)) {
                                usedBufferViewIds[property.bufferView] = true;
                            }
                            if (defined(property.arrayOffsetBufferView)) {
                                usedBufferViewIds[property.arrayOffsetBufferView] = true;
                            }
                            if (defined(property.stringOffsetBufferView)) {
                                usedBufferViewIds[property.stringOffsetBufferView] = true;
                            }
                        }
                    }
                }
            }
        }
    }

    return usedBufferViewIds;
};

getListOfElementsIdsInUse.image = function(gltf) {
    var usedImageIds = {};

    ForEach.texture(gltf, function (texture) {
        if (defined(texture.source)) {
            usedImageIds[texture.source] = true;
        }

        if (defined(texture.extensions) && defined(texture.extensions.EXT_texture_webp)) {
            usedImageIds[texture.extensions.EXT_texture_webp.source] = true;
        } else if (defined(texture.extensions) && defined(texture.extensions.KHR_texture_basisu)) {
            usedImageIds[texture.extensions.KHR_texture_basisu.source] = true;
        }

    });
    return usedImageIds;
};

getListOfElementsIdsInUse.mesh = function(gltf) {
    var usedMeshIds = {};
    ForEach.node(gltf, function(node) {
        if (defined(node.mesh && defined(gltf.meshes))) {
            var mesh = gltf.meshes[node.mesh];
            if (defined(mesh) && defined(mesh.primitives) && (mesh.primitives.length > 0)) {
                usedMeshIds[node.mesh] = true;
            }
        }
    });

    return usedMeshIds;
};

// Check if node is empty. It is considered empty if neither referencing
// mesh, camera, extensions and has no children
function nodeIsEmpty(gltf, nodeId, usedNodeIds) {
    var node = gltf.nodes[nodeId];
    if (defined(node.mesh) || defined(node.camera) || defined(node.skin)
        || defined(node.weights) || defined(node.extras)
        || (defined(node.extensions) && Object.keys(node.extensions).length !== 0)
        || defined(usedNodeIds[nodeId])) {
        return false;
    }

    // Empty if no children or children are all empty nodes
    return !defined(node.children)
        || node.children.filter(function(n) {
            return !nodeIsEmpty(gltf, n, usedNodeIds);
        }).length === 0;
}

getListOfElementsIdsInUse.node = function(gltf) {
    var usedNodeIds = {};
    ForEach.skin(gltf, function(skin) {
        if (defined(skin.skeleton)) {
            usedNodeIds[skin.skeleton] = true;
        }

        ForEach.skinJoint(skin, function(joint) {
            usedNodeIds[joint] = true;
        });
    });
    ForEach.animation(gltf, function(animation) {
        ForEach.animationChannel(animation, function(channel) {
            if (defined(channel.target) && defined(channel.target.node)) {
                usedNodeIds[channel.target.node] = true;
            }
        });
    });
    ForEach.technique(gltf, function(technique) {
        ForEach.techniqueUniform(technique, function(uniform) {
            if (defined(uniform.node)) {
                usedNodeIds[uniform.node] = true;
            }
        });
    });
    ForEach.node(gltf, function(node, nodeId) {
        if (!nodeIsEmpty(gltf, nodeId, usedNodeIds)) {
            usedNodeIds[nodeId] = true;
        }
    });

    return usedNodeIds;
};

getListOfElementsIdsInUse.material = function(gltf) {
    var usedMaterialIds = {};

    ForEach.mesh(gltf, function(mesh) {
        ForEach.meshPrimitive(mesh, function(primitive) {
            if (defined(primitive.material)) {
                usedMaterialIds[primitive.material] = true;
            }
        });
    });

    return usedMaterialIds;
};

getListOfElementsIdsInUse.texture = function(gltf) {
    var usedTextureIds = {};

    ForEach.material(gltf, function(material) {
        forEachTextureInMaterial(material, function(textureId) {
            usedTextureIds[textureId] = true;
        });
    });

    if (usesExtension(gltf, 'EXT_feature_metadata')) {
        ForEach.mesh(gltf, function(mesh) {
            ForEach.meshPrimitive(mesh, function(primitive) {
                var extensions = primitive.extensions;
                if (defined(extensions) && defined(extensions.EXT_feature_metadata)) {
                    var extension = extensions.EXT_feature_metadata;
                    var featureIdTextures = extension.featureIdTextures;
                    if (defined(featureIdTextures)) {
                        var featureIdTexturesLength = featureIdTextures.length;
                        for (var i = 0; i < featureIdTexturesLength; ++i) {
                            var featureIdTexture = featureIdTextures[i];
                            var textureInfo = featureIdTexture.featureIds.texture;
                            usedTextureIds[textureInfo.index] = true;
                        }
                    }
                }
            });
        });

        var extension = gltf.extensions.EXT_feature_metadata;
        var featureTextures = extension.featureTextures;
        for (var featureTextureId in featureTextures) {
            if (featureTextures.hasOwnProperty(featureTextureId)) {
                var featureTexture = featureTextures[featureTextureId];
                var properties = featureTexture.properties;
                if (defined(properties)) {
                    for (var propertyId in properties) {
                        if (properties.hasOwnProperty(propertyId)) {
                            var property = properties[propertyId];
                            var textureInfo = property.texture;
                            usedTextureIds[textureInfo.index] = true;
                        }
                    }
                }
            }
        }
    }

    return usedTextureIds;
};

getListOfElementsIdsInUse.sampler = function(gltf) {
    var usedSamplerIds = {};

    ForEach.texture(gltf, function (texture) {
        if (defined(texture.sampler)) {
            usedSamplerIds[texture.sampler] = true;
        }
    });

    return usedSamplerIds;
};

export default removeUnusedElements;