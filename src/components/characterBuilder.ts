import * as THREE from 'three';
import { CharacterModelType, ColorPalette } from '../types';

export interface ArticulatedCharacter {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  headbandRibbon?: THREE.Mesh;
  leftArm: {
    shoulder: THREE.Group;
    elbow: THREE.Group;
  };
  rightArm: {
    shoulder: THREE.Group;
    elbow: THREE.Group;
  };
  leftLeg: {
    hip: THREE.Group;
    knee: THREE.Group;
    foot: THREE.Mesh;
  };
  rightLeg: {
    hip: THREE.Group;
    knee: THREE.Group;
    foot: THREE.Mesh;
  };
  plankMount: THREE.Group;
  materials: {
    skin: THREE.MeshStandardMaterial;
    clothTop: THREE.MeshStandardMaterial;
    clothBottom: THREE.MeshStandardMaterial;
    accent: THREE.MeshStandardMaterial;
    shoes: THREE.MeshStandardMaterial;
    hair: THREE.MeshStandardMaterial;
    eyes: THREE.MeshBasicMaterial;
  };
}

/**
 * Creates an articulated, lively low-poly character
 * with joint hierarchies, facial features, hair, and athletic clothing.
 */
export function buildArticulatedCharacter(
  type: CharacterModelType = 'runner_boy',
  palette: ColorPalette,
  isAi: boolean = false
): ArticulatedCharacter {
  const root = new THREE.Group();

  // Color schemes based on character type and palette
  const primaryColor = isAi ? palette.accentColor : palette.playerColor;
  
  let skinHex = '#F8D2B1';
  let topHex = primaryColor;
  let bottomHex = '#1E293B';
  let accentHex = isAi ? '#F59E0B' : '#EF4444';
  let shoesHex = '#FFFFFF';
  let hairHex = '#452A18';

  if (type === 'chibi_ninja') {
    topHex = '#1E222D';
    bottomHex = '#111827';
    accentHex = '#DC2626'; // Vibrant red ninja headband
    shoesHex = '#0F172A';
    hairHex = '#111827';
  } else if (type === 'beach_dude') {
    topHex = '#F59E0B'; // Hawaiian warm yellow
    bottomHex = '#06B6D4'; // Cyan swim trunks
    accentHex = '#10B981';
    hairHex = '#EAB308'; // Blonde
    shoesHex = '#F3F4F6';
  } else if (type === 'voxel_bot') {
    skinHex = '#94A3B8';
    topHex = isAi ? '#6366F1' : '#3B82F6';
    bottomHex = '#1E293B';
    accentHex = '#06B6D4';
    shoesHex = '#0284C7';
    hairHex = '#475569';
  } else if (type === 'stickman') {
    // Pure minimalist VOODOO color block
    skinHex = primaryColor;
    topHex = primaryColor;
    bottomHex = primaryColor;
    accentHex = primaryColor;
    shoesHex = '#FFFFFF';
    hairHex = primaryColor;
  }

  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.4 }),
    clothTop: new THREE.MeshStandardMaterial({ color: topHex, roughness: 0.35 }),
    clothBottom: new THREE.MeshStandardMaterial({ color: bottomHex, roughness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.3 }),
    shoes: new THREE.MeshStandardMaterial({ color: shoesHex, roughness: 0.3 }),
    hair: new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.5 }),
    eyes: new THREE.MeshBasicMaterial({ color: '#111827' }),
  };

  // 1. Root & Torso Group
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.72, 0);
  root.add(torsoGroup);

  // Pelvis / Shorts
  const pelvisGeo = new THREE.CylinderGeometry(0.32, 0.3, 0.32, 8);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, materials.clothBottom);
  pelvisMesh.position.y = 0.16;
  pelvisMesh.castShadow = true;
  torsoGroup.add(pelvisMesh);

  // Athletic Chest & Jersey
  const chestGeo = new THREE.CylinderGeometry(0.38, 0.31, 0.55, 8);
  const chestMesh = new THREE.Mesh(chestGeo, materials.clothTop);
  chestMesh.position.y = 0.55;
  chestMesh.castShadow = true;
  torsoGroup.add(chestMesh);

  // Jersey race number or sporty front stripe
  if (type !== 'stickman') {
    const bibGeo = new THREE.PlaneGeometry(0.26, 0.22);
    const bibMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide });
    const bibMesh = new THREE.Mesh(bibGeo, bibMat);
    bibMesh.position.set(0, 0.56, 0.36);
    torsoGroup.add(bibMesh);

    // Number line
    const numGeo = new THREE.PlaneGeometry(0.12, 0.14);
    const numMat = new THREE.MeshBasicMaterial({ color: accentHex, side: THREE.DoubleSide });
    const numMesh = new THREE.Mesh(numGeo, numMat);
    numMesh.position.set(0, 0.56, 0.362);
    torsoGroup.add(numMesh);
  }

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.18, 6);
  const neckMesh = new THREE.Mesh(neckGeo, materials.skin);
  neckMesh.position.y = 0.88;
  torsoGroup.add(neckMesh);

  // 2. Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.15, 0);
  torsoGroup.add(headGroup);

  // Stylized Head Mesh
  const headGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const headMesh = new THREE.Mesh(headGeo, materials.skin);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  let headbandRibbon: THREE.Mesh | undefined;

  if (type !== 'stickman') {
    // Eyes: Expressive Cartoon Pupils & Sclera
    const eyeGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#0F172A' });

    const eyeL = new THREE.Mesh(eyeGeo, pupilMat);
    eyeL.scale.set(1, 1.3, 0.5);
    eyeL.position.set(-0.12, 0.04, 0.28);
    eyeL.rotation.y = 0.15;
    headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, pupilMat);
    eyeR.scale.set(1, 1.3, 0.5);
    eyeR.position.set(0.12, 0.04, 0.28);
    eyeR.rotation.y = -0.15;
    headGroup.add(eyeR);

    // Eye catchlights (sparkle)
    const catchGeo = new THREE.PlaneGeometry(0.03, 0.03);
    const catchMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide });
    const catchL = new THREE.Mesh(catchGeo, catchMat);
    catchL.position.set(-0.1, 0.07, 0.315);
    headGroup.add(catchL);
    const catchR = new THREE.Mesh(catchGeo, catchMat);
    catchR.position.set(0.14, 0.07, 0.315);
    headGroup.add(catchR);

    // Hair / Cap Styling
    if (type === 'runner_boy' || type === 'beach_dude') {
      const hairGeo = new THREE.ConeGeometry(0.36, 0.35, 7);
      const hairMesh = new THREE.Mesh(hairGeo, materials.hair);
      hairMesh.position.set(0, 0.2, -0.04);
      hairMesh.rotation.x = -0.2;
      headGroup.add(hairMesh);

      // Front fringe
      const fringeGeo = new THREE.BoxGeometry(0.34, 0.12, 0.22);
      const fringeMesh = new THREE.Mesh(fringeGeo, materials.hair);
      fringeMesh.position.set(0, 0.24, 0.15);
      fringeMesh.rotation.x = 0.25;
      headGroup.add(fringeMesh);

      // Athletic Headband
      const bandGeo = new THREE.CylinderGeometry(0.335, 0.335, 0.1, 12, 1, true);
      const bandMesh = new THREE.Mesh(bandGeo, materials.accent);
      bandMesh.position.y = 0.1;
      headGroup.add(bandMesh);

      // Dynamic fluttering ribbon tails at the back of head!
      const ribbonGeo = new THREE.BoxGeometry(0.14, 0.04, 0.55);
      ribbonGeo.translate(0, 0, -0.27);
      headbandRibbon = new THREE.Mesh(ribbonGeo, materials.accent);
      headbandRibbon.position.set(0, 0.12, -0.32);
      headGroup.add(headbandRibbon);
    } else if (type === 'chibi_ninja') {
      // Ninja hood
      const hoodGeo = new THREE.SphereGeometry(0.345, 10, 8);
      const hoodMesh = new THREE.Mesh(hoodGeo, materials.clothTop);
      hoodMesh.position.set(0, 0.02, -0.02);
      headGroup.add(hoodMesh);

      // Red ninja headband ribbon
      const bandGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 12, 1, true);
      const bandMesh = new THREE.Mesh(bandGeo, materials.accent);
      bandMesh.position.y = 0.1;
      headGroup.add(bandMesh);

      // Long fluttering ninja tails
      const ribbonGeo = new THREE.BoxGeometry(0.16, 0.04, 0.75);
      ribbonGeo.translate(0, 0, -0.37);
      headbandRibbon = new THREE.Mesh(ribbonGeo, materials.accent);
      headbandRibbon.position.set(0, 0.12, -0.34);
      headGroup.add(headbandRibbon);
    } else if (type === 'voxel_bot') {
      // Cyber visor
      const visorGeo = new THREE.BoxGeometry(0.48, 0.16, 0.24);
      const visorMat = new THREE.MeshStandardMaterial({
        color: '#06B6D4',
        roughness: 0.1,
        emissive: new THREE.Color('#0891B2'),
        emissiveIntensity: 0.4,
      });
      const visorMesh = new THREE.Mesh(visorGeo, visorMat);
      visorMesh.position.set(0, 0.06, 0.22);
      headGroup.add(visorMesh);
    }
  }

  // 3. Articulated Legs (Hips -> Thigh -> Knee -> Calf -> Sneaker)
  const createLeg = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;

    // Hip Joint Group (rotates on X for forward/backward stride)
    const hip = new THREE.Group();
    hip.position.set(side * 0.2, 0.08, 0);
    torsoGroup.add(hip);

    // Thigh
    const thighGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.38, 6);
    thighGeo.translate(0, -0.19, 0);
    const thighMesh = new THREE.Mesh(thighGeo, materials.clothBottom);
    thighMesh.castShadow = true;
    hip.add(thighMesh);

    // Knee Joint Group (rotates on X to bend backward)
    const knee = new THREE.Group();
    knee.position.set(0, -0.38, 0);
    hip.add(knee);

    // Calf / Shin
    const calfGeo = new THREE.CylinderGeometry(0.09, 0.075, 0.38, 6);
    calfGeo.translate(0, -0.19, 0);
    const calfMesh = new THREE.Mesh(calfGeo, materials.skin);
    calfMesh.castShadow = true;
    knee.add(calfMesh);

    // Running Sneaker
    const shoeGeo = new THREE.BoxGeometry(0.18, 0.14, 0.34);
    shoeGeo.translate(0, -0.07, 0.06);
    const foot = new THREE.Mesh(shoeGeo, materials.shoes);
    foot.position.set(0, -0.36, 0);
    foot.castShadow = true;
    knee.add(foot);

    // Sneaker Sole (High-contrast white rubber rim)
    const soleGeo = new THREE.BoxGeometry(0.19, 0.05, 0.36);
    soleGeo.translate(0, -0.135, 0.06);
    const soleMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const soleMesh = new THREE.Mesh(soleGeo, soleMat);
    knee.add(soleMesh);

    return { hip, knee, foot };
  };

  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);

  // 4. Articulated Arms (Shoulder -> UpperArm -> Elbow -> Forearm -> Hand)
  // Posed holding forward to naturally embrace the carried planks!
  const createArm = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;

    // Shoulder Joint
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.42, 0.72, 0);
    torsoGroup.add(shoulder);

    // Upper Arm
    const upperGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.34, 6);
    upperGeo.translate(0, -0.17, 0);
    const upperMesh = new THREE.Mesh(upperGeo, materials.skin);
    upperMesh.castShadow = true;
    shoulder.add(upperMesh);

    // Elbow Joint
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.32, 0);
    shoulder.add(elbow);

    // Forearm reaching forward to cradle planks
    const foreGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.34, 6);
    foreGeo.translate(0, 0, 0.17); // reach forward in Z
    foreGeo.rotateX(Math.PI / 2);
    const foreMesh = new THREE.Mesh(foreGeo, materials.skin);
    foreMesh.castShadow = true;
    elbow.add(foreMesh);

    // Hand (cupping underneath the planks)
    const handGeo = new THREE.BoxGeometry(0.12, 0.09, 0.15);
    const handMesh = new THREE.Mesh(handGeo, materials.skin);
    handMesh.position.set(side * -0.05, -0.02, 0.35);
    elbow.add(handMesh);

    return { shoulder, elbow };
  };

  const leftArm = createArm(true);
  const rightArm = createArm(false);

  // 5. Plank Stack Mount Point
  // CRITICAL: Positioned in FRONT of chest (z: +0.62) so it does NOT mask the runner!
  const plankMount = new THREE.Group();
  plankMount.position.set(0, 0.58, 0.62);
  torsoGroup.add(plankMount);

  return {
    root,
    torso: torsoGroup,
    head: headGroup,
    headbandRibbon,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    plankMount,
    materials,
  };
}

/**
 * Procedurally animates the character runner:
 * - Natural running gait (thigh stride + knee flex)
 * - Torso bobbing & forward sprint lean
 * - Banking/leaning into steer turns
 * - Wind fluttering on headband ribbons
 * - Arm micro-bounce while carrying heavy load
 */
export function animateCharacter(
  char: ArticulatedCharacter,
  runCycle: number,
  steerVelocity: number,
  carriedPlanks: number,
  state: 'idle' | 'running' | 'bridging' | 'drowned' | 'finished',
  delta: number
) {
  if (state === 'drowned') {
    // Fall and spin down into water
    char.root.rotation.x = THREE.MathUtils.lerp(char.root.rotation.x, Math.PI / 2, delta * 5);
    char.root.rotation.z = THREE.MathUtils.lerp(char.root.rotation.z, 0.6, delta * 4);
    char.torso.position.y = THREE.MathUtils.lerp(char.torso.position.y, -0.8, delta * 3);
    return;
  }

  if (state === 'finished') {
    // Victory cheering pose!
    char.torso.rotation.x = THREE.MathUtils.lerp(char.torso.rotation.x, -0.15, delta * 5);
    char.torso.rotation.z = 0;
    char.torso.position.y = 0.72 + Math.abs(Math.sin(runCycle * 4)) * 0.25;

    // Both arms raised in triumph
    char.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(char.leftArm.shoulder.rotation.x, -2.8, delta * 6);
    char.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(char.leftArm.shoulder.rotation.z, -0.4, delta * 6);
    char.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(char.rightArm.shoulder.rotation.x, -2.8, delta * 6);
    char.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(char.rightArm.shoulder.rotation.z, 0.4, delta * 6);

    // Legs straight / light celebration bounce
    char.leftLeg.hip.rotation.x = 0;
    char.rightLeg.hip.rotation.x = 0;
    char.leftLeg.knee.rotation.x = 0.1;
    char.rightLeg.knee.rotation.x = 0.1;
    return;
  }

  // Active Running Gait:
  const stride = Math.sin(runCycle);
  const lift = Math.cos(runCycle);

  // 1. Torso Dynamics
  // Sprint lean forward: 0.18 rad (~10 deg)
  char.torso.rotation.x = 0.16 + (carriedPlanks > 15 ? 0.06 : 0);
  // Torso twists slightly with running strides
  char.torso.rotation.y = Math.sin(runCycle) * 0.08;
  // Banking / leaning into turns (responsive game feel)
  const targetRoll = -steerVelocity * 0.32;
  char.torso.rotation.z = THREE.MathUtils.lerp(char.torso.rotation.z, targetRoll, delta * 12);
  // Vertical step bounce
  char.torso.position.y = 0.72 + Math.abs(stride) * 0.12;

  // 2. Head Bobbing & Eye Focus
  char.head.rotation.x = -char.torso.rotation.x * 0.8; // Counteract lean to keep eyes ahead
  char.head.rotation.y = -char.torso.rotation.y * 0.5;

  // 3. Headband Ribbon fluttering in headwind
  if (char.headbandRibbon) {
    char.headbandRibbon.rotation.x = -0.35 + Math.sin(runCycle * 2.5) * 0.22;
    char.headbandRibbon.rotation.y = Math.cos(runCycle * 2) * 0.15;
  }

  // 4. Legs Animation (Authentic runner stride)
  // Left leg: Hip swings forward/backward, Knee flexes on back-swing
  char.leftLeg.hip.rotation.x = stride * 0.82;
  char.leftLeg.knee.rotation.x = stride > 0 ? 0.1 : Math.max(0, -stride * 1.35);

  // Right leg: Inverted phase
  char.rightLeg.hip.rotation.x = -stride * 0.82;
  char.rightLeg.knee.rotation.x = -stride > 0 ? 0.1 : Math.max(0, stride * 1.35);

  // 5. Arms & Carrying Animation
  if (carriedPlanks > 0) {
    // Arms bent forward holding the plank stack
    // Left Arm
    char.leftArm.shoulder.rotation.x = 0.58 + Math.sin(runCycle) * 0.08;
    char.leftArm.shoulder.rotation.z = 0.22;
    char.leftArm.shoulder.rotation.y = -0.28;
    char.leftArm.elbow.rotation.x = -1.25;

    // Right Arm
    char.rightArm.shoulder.rotation.x = 0.58 - Math.sin(runCycle) * 0.08;
    char.rightArm.shoulder.rotation.z = -0.22;
    char.rightArm.shoulder.rotation.y = 0.28;
    char.rightArm.elbow.rotation.x = -1.25;
  } else {
    // Normal athletic arm pumping when carrying no planks
    char.leftArm.shoulder.rotation.x = -stride * 0.8;
    char.leftArm.shoulder.rotation.z = 0.15;
    char.leftArm.shoulder.rotation.y = 0;
    char.leftArm.elbow.rotation.x = -0.6;

    char.rightArm.shoulder.rotation.x = stride * 0.8;
    char.rightArm.shoulder.rotation.z = -0.15;
    char.rightArm.shoulder.rotation.y = 0;
    char.rightArm.elbow.rotation.x = -0.6;
  }

  // 6. Planks Stack Inertia & Secondary Sway
  // Stacking tilts slightly when steering, giving delicious VOODOO tactile weight
  const stackRoll = -steerVelocity * 0.42;
  char.plankMount.rotation.z = THREE.MathUtils.lerp(char.plankMount.rotation.z, stackRoll, delta * 10);
  char.plankMount.rotation.x = 0.04 + Math.sin(runCycle * 2) * 0.04;
}
