/**
 * Prompt builder for Heritage, ZERO, and Mutation modes
 */

export type GenerationMode = 'simple' | 'heritage' | 'zero' | 'mutation' | 'reinterpret';

export interface ModeOptions {
  mode: GenerationMode;
  heritage?: {
    code: string;
    ratio: number; // 0-1
  };
  subtractor?: {
    code: string;
    ratio: number; // 0-1
  };
  constraints?: string[];
  materials?: string[];
  basePrompt?: string;
}

// Constraint dictionary with prompts
export const constraintToPrompt: Record<string, string> = {
  // Form constraints
  no_straight_lines: "no straight lines, only curves and organic forms",
  spiral_construction: "spiral construction wrapping around body",
  no_symmetry: "completely asymmetric, no mirrored elements",
  
  // Structure constraints
  asymmetric_left_right: "asymmetric left-right construction, unbalanced design",
  exposed_seams: "exposed seams as visible design feature, raw edges prominent",
  inside_out: "inside-out appearance with lining outward, reversed construction",
  modular_detachable: "modular detachable components, transformable garment",
  
  // Visual constraints
  gravity_offset: "center of gravity visually offset by 30%, unstable appearance",
  one_bit_palette: "binary palette look with high-contrast edges, black and white only",
  transparent_layers: "transparent and opaque layers interplay",
  
  // Additional experimental constraints
  fractured_silhouette: "fractured silhouette with broken lines",
  floating_elements: "floating disconnected elements around the body",
  negative_space: "negative space as primary design element",
  moebius_strip: "moebius strip construction, continuous surface",
  trompe_loeil: "trompe l'oeil optical illusion effects",
};

// Material dictionary with prompts
export const materialToPrompt: Record<string, string> = {
  // Textile innovations
  phase_fiber: "phase-change fiber textile with thermal regulation",
  aerogel_insulation: "aerogel insulation pockets, ultra-light padding",
  shape_memory: "shape-memory alloy framework, adaptive structure",
  
  // Bio materials
  mycelium_leather: "mycelium-based leather alternative, fungal material",
  bio_plastic: "biodegradable plastic coating, sustainable finish",
  algae_foam: "algae-based foam padding, renewable cushioning",
  bio_dye: "bio-reactive dyeing pattern, living color changes",
  
  // Technical treatments
  tri_axial_weave: "tri-axial weaving structure, three-directional strength",
  retroreflective: "retroreflective thread accents, light-returning details",
  conductive_thread: "conductive thread embroidery for tech integration",
  
  // Experimental materials
  liquid_metal: "liquid metal mesh inserts",
  photochromic: "photochromic color-changing fabric",
  magnetic_closure: "magnetic field-responsive closures",
  graphene_coating: "graphene-enhanced coating",
  acoustic_dampening: "acoustic dampening material layers",
};

// Heritage style descriptions
const heritageStyles: Record<string, string> = {
  comme: "deconstructed avant-garde with asymmetric volumes, conceptual silhouettes inspired by Comme des Garçons",
  margiela: "artisanal deconstruction with exposed construction details, raw edges in Maison Margiela aesthetic",
  dries: "eclectic pattern mixing with rich textures, culturally-fused prints in Dries Van Noten style",
  yohji: "oversized draped silhouettes in monochrome palette, Japanese minimalism of Yohji Yamamoto",
  issey: "architectural pleating with geometric forms, innovative textile manipulation like Issey Miyake",
};

// Anti-reference phrases for ZERO mode
const zeroModeAntiPatterns: Record<string, string> = {
  comme: "avoiding typical deconstruction, no obvious asymmetry, beyond conceptual fashion tropes",
  margiela: "no exposed construction clichés, beyond artisanal aesthetics, avoiding deconstruction patterns",
  dries: "no predictable pattern mixing, avoiding ethnic fusion clichés, beyond decorative excess",
  yohji: "no oversized draping clichés, beyond monochrome minimalism, avoiding Japanese fashion tropes",
  issey: "no geometric pleating patterns, beyond architectural fashion, avoiding tech-fabric clichés",
};

/**
 * Build the complete prompt with mode-specific modifications
 */
export function buildGenerationPrompt(options: ModeOptions): string {
  const parts: string[] = [];
  
  // Add base prompt if provided
  if (options.basePrompt) {
    parts.push(options.basePrompt);
  }
  
  // Mode-specific additions
  switch (options.mode) {
    case 'simple':
      // Simple mode: just use base prompt with safety constraints
      break;
      
    case 'heritage':
      if (options.heritage) {
        const style = heritageStyles[options.heritage.code];
        if (style) {
          const intensity = Math.round(options.heritage.ratio * 100);
          parts.push(`${style}, heritage intensity ${intensity}%`);
        }
      }
      break;
      
    case 'zero':
      if (options.subtractor) {
        const antiPattern = zeroModeAntiPatterns[options.subtractor.code];
        if (antiPattern) {
          parts.push(antiPattern);
          parts.push("innovative construction methods, unprecedented silhouette logic");
          parts.push("novel form language, experimental proportions");
          const intensity = Math.round(options.subtractor.ratio * 100);
          parts.push(`deviation intensity ${intensity}%`);
        }
      }
      break;
      
    case 'mutation':
      // Add constraint prompts
      if (options.constraints && options.constraints.length > 0) {
        const constraintPrompts = options.constraints
          .map(c => constraintToPrompt[c])
          .filter(Boolean);
        if (constraintPrompts.length > 0) {
          parts.push(constraintPrompts.join(", "));
          parts.push("constraints must be visually central to the design");
        }
      }
      
      // Add material prompts
      if (options.materials && options.materials.length > 0) {
        const materialPrompts = options.materials
          .map(m => materialToPrompt[m])
          .filter(Boolean);
        if (materialPrompts.length > 0) {
          parts.push(materialPrompts.join(", "));
          parts.push("materials must define the aesthetic");
        }
      }
      break;
      
    case 'reinterpret':
      // Reinterpretation will be handled with parent asset context
      parts.push("reinterpreted design, evolved concept");
      break;
  }
  
  // Always add professional photography context
  parts.push("single full-body fashion model");
  parts.push("one person only");
  parts.push("clean minimal background");
  parts.push("professional fashion photography");
  parts.push("studio lighting");
  parts.push("editorial fashion shoot");
  
  // Single --no parameter (Midjourney limitation)
  parts.push("--no text, multiple people, nsfw, nude");
  
  // Filter out empty parts and join
  return parts
    .filter(p => p && p.trim())
    .join(", ")
    .replace(/,\s*,/g, ",") // Remove double commas
    .trim();
}

/**
 * Extract mode parameters from a generation request
 */
export function extractModeParams(params: any): ModeOptions {
  const mode = params.mode || 'simple';
  
  const options: ModeOptions = { mode };
  
  if (params.heritage && mode === 'heritage') {
    options.heritage = {
      code: params.heritage.code,
      ratio: Math.max(0, Math.min(1, params.heritage.ratio || 0.5)),
    };
  }
  
  if (params.subtractor && mode === 'zero') {
    options.subtractor = {
      code: params.subtractor.code,
      ratio: Math.max(0, Math.min(1, params.subtractor.ratio || 0.5)),
    };
  }
  
  if (params.constraints && mode === 'mutation') {
    options.constraints = Array.isArray(params.constraints) 
      ? params.constraints.filter(c => c in constraintToPrompt)
      : [];
  }
  
  if (params.materials && mode === 'mutation') {
    options.materials = Array.isArray(params.materials)
      ? params.materials.filter(m => m in materialToPrompt)
      : [];
  }
  
  if (params.prompt) {
    options.basePrompt = params.prompt;
  }
  
  return options;
}

/**
 * Generate a random mutation deck (3 constraints + 2 materials)
 */
export function generateRandomMutationDeck(): {
  constraints: string[];
  materials: string[];
} {
  const allConstraints = Object.keys(constraintToPrompt);
  const allMaterials = Object.keys(materialToPrompt);
  
  // Shuffle and pick 3 constraints
  const shuffledConstraints = [...allConstraints].sort(() => Math.random() - 0.5);
  const constraints = shuffledConstraints.slice(0, 3);
  
  // Shuffle and pick 2 materials
  const shuffledMaterials = [...allMaterials].sort(() => Math.random() - 0.5);
  const materials = shuffledMaterials.slice(0, 2);
  
  return { constraints, materials };
}

/**
 * Get constraint metadata
 */
export function getConstraintInfo(code: string): {
  code: string;
  prompt: string;
  category: 'form' | 'structure' | 'visual';
} | null {
  const prompt = constraintToPrompt[code];
  if (!prompt) return null;
  
  // Categorize based on code patterns
  let category: 'form' | 'structure' | 'visual' = 'structure';
  if (['no_straight_lines', 'spiral_construction', 'no_symmetry', 'moebius_strip'].includes(code)) {
    category = 'form';
  } else if (['gravity_offset', 'one_bit_palette', 'transparent_layers', 'trompe_loeil'].includes(code)) {
    category = 'visual';
  }
  
  return { code, prompt, category };
}

/**
 * Get material metadata
 */
export function getMaterialInfo(code: string): {
  code: string;
  prompt: string;
  category: 'textile' | 'bio' | 'treatment' | 'experimental';
} | null {
  const prompt = materialToPrompt[code];
  if (!prompt) return null;
  
  // Categorize based on code patterns
  let category: 'textile' | 'bio' | 'treatment' | 'experimental' = 'textile';
  if (['mycelium_leather', 'bio_plastic', 'algae_foam', 'bio_dye'].includes(code)) {
    category = 'bio';
  } else if (['tri_axial_weave', 'retroreflective', 'conductive_thread'].includes(code)) {
    category = 'treatment';
  } else if (['liquid_metal', 'photochromic', 'magnetic_closure', 'graphene_coating'].includes(code)) {
    category = 'experimental';
  }
  
  return { code, prompt, category };
}