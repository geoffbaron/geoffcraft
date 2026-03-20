// Block type definitions
export const BlockType = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    SAND: 4,
    WATER: 5,
    WOOD: 6,
    LEAVES: 7,
    COBBLESTONE: 8,
    PLANKS: 9,
    SNOW: 10,
    BEDROCK: 11,
    GRAVEL: 12,
    COAL_ORE: 13,
    IRON_ORE: 14,
    GLASS: 15,
    BRICK: 16,
};

// Block properties
export const BlockData = {
    [BlockType.AIR]:         { name: 'Air',         solid: false, transparent: true  },
    [BlockType.GRASS]:       { name: 'Grass',       solid: true,  transparent: false },
    [BlockType.DIRT]:        { name: 'Dirt',        solid: true,  transparent: false },
    [BlockType.STONE]:       { name: 'Stone',       solid: true,  transparent: false },
    [BlockType.SAND]:        { name: 'Sand',        solid: true,  transparent: false },
    [BlockType.WATER]:       { name: 'Water',       solid: false, transparent: true  },
    [BlockType.WOOD]:        { name: 'Wood',        solid: true,  transparent: false },
    [BlockType.LEAVES]:      { name: 'Leaves',      solid: true,  transparent: true  },
    [BlockType.COBBLESTONE]: { name: 'Cobblestone', solid: true,  transparent: false },
    [BlockType.PLANKS]:      { name: 'Planks',      solid: true,  transparent: false },
    [BlockType.SNOW]:        { name: 'Snow',        solid: true,  transparent: false },
    [BlockType.BEDROCK]:     { name: 'Bedrock',     solid: true,  transparent: false },
    [BlockType.GRAVEL]:      { name: 'Gravel',      solid: true,  transparent: false },
    [BlockType.COAL_ORE]:    { name: 'Coal Ore',    solid: true,  transparent: false },
    [BlockType.IRON_ORE]:    { name: 'Iron Ore',    solid: true,  transparent: false },
    [BlockType.GLASS]:       { name: 'Glass',       solid: true,  transparent: true  },
    [BlockType.BRICK]:       { name: 'Brick',       solid: true,  transparent: false },
};

// Color definitions for each block face [top, bottom, side] as RGB arrays
export const BlockColors = {
    [BlockType.GRASS]:       { top: [0.36, 0.7, 0.2],  bottom: [0.55, 0.38, 0.22], side: [0.55, 0.38, 0.22], sideTop: [0.36, 0.7, 0.2] },
    [BlockType.DIRT]:        { top: [0.55, 0.38, 0.22], bottom: [0.55, 0.38, 0.22], side: [0.55, 0.38, 0.22] },
    [BlockType.STONE]:       { top: [0.5, 0.5, 0.5],   bottom: [0.5, 0.5, 0.5],   side: [0.5, 0.5, 0.5] },
    [BlockType.SAND]:        { top: [0.86, 0.82, 0.58], bottom: [0.86, 0.82, 0.58], side: [0.82, 0.78, 0.55] },
    [BlockType.WATER]:       { top: [0.2, 0.4, 0.8],   bottom: [0.2, 0.4, 0.8],   side: [0.2, 0.4, 0.8] },
    [BlockType.WOOD]:        { top: [0.6, 0.5, 0.3],   bottom: [0.6, 0.5, 0.3],   side: [0.45, 0.32, 0.18] },
    [BlockType.LEAVES]:      { top: [0.2, 0.55, 0.15], bottom: [0.2, 0.55, 0.15], side: [0.18, 0.5, 0.12] },
    [BlockType.COBBLESTONE]: { top: [0.45, 0.45, 0.45], bottom: [0.45, 0.45, 0.45], side: [0.42, 0.42, 0.42] },
    [BlockType.PLANKS]:      { top: [0.7, 0.55, 0.3],  bottom: [0.7, 0.55, 0.3],  side: [0.65, 0.5, 0.28] },
    [BlockType.SNOW]:        { top: [0.95, 0.95, 0.98], bottom: [0.85, 0.85, 0.88], side: [0.9, 0.9, 0.93] },
    [BlockType.BEDROCK]:     { top: [0.2, 0.2, 0.2],   bottom: [0.2, 0.2, 0.2],   side: [0.2, 0.2, 0.2] },
    [BlockType.GRAVEL]:      { top: [0.55, 0.53, 0.5],  bottom: [0.55, 0.53, 0.5], side: [0.52, 0.5, 0.48] },
    [BlockType.COAL_ORE]:    { top: [0.4, 0.4, 0.4],   bottom: [0.4, 0.4, 0.4],   side: [0.38, 0.38, 0.38] },
    [BlockType.IRON_ORE]:    { top: [0.55, 0.5, 0.48], bottom: [0.55, 0.5, 0.48], side: [0.52, 0.47, 0.45] },
    [BlockType.GLASS]:       { top: [0.8, 0.9, 0.95],  bottom: [0.8, 0.9, 0.95],  side: [0.8, 0.9, 0.95] },
    [BlockType.BRICK]:       { top: [0.6, 0.3, 0.25],  bottom: [0.6, 0.3, 0.25],  side: [0.58, 0.28, 0.22] },
};

export function isBlockSolid(type) {
    return BlockData[type]?.solid ?? false;
}

export function isBlockTransparent(type) {
    return BlockData[type]?.transparent ?? true;
}
