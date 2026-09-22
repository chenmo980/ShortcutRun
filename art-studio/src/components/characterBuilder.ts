import * as THREE from 'three';
import { CharacterModelType, ColorPalette } from '../types';

export interface ArticulatedCharacter {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  hairGroup?: THREE.Group;
  headbandRibbons?: THREE.Mesh[];
  leftArm: {
    shoulder: THREE.Group;
    elbow: THREE.Group;
    hand: THREE.Group;
  };
  rightArm: {
    shoulder: THREE.Group;
    elbow: THREE.Group;
    hand: THREE.Group;
  };
  leftLeg: {
    hip: THREE.Group;
    knee: THREE.Group;
    foot: THREE.Group;
  };
  rightLeg: {
    hip: THREE.Group;
    knee: THREE.Group;
    foot: THREE.Group;
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
 * Creates an articulated, highly detailed and lively low-poly character
 * with volumetric clustered hair, expressive eyes, athletic uniform,
 * cupped hands for carrying planks, sneaker sole details, and joint hierarchies.
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
  let shoesHex = '#0F172A';
  let hairHex = '#3B2414';

  if (type === 'wukong') {
    // 齐天大圣 / 美猴王: 金毛、大红锦袍、虎皮战裙、纯金紧箍与护臂
    skinHex = '#FCD34D';
    topHex = '#DC2626';
    bottomHex = '#B45309';
    accentHex = '#F59E0B'; // 璀璨纯金
    shoesHex = '#1E293B'; // 藕丝步云履
    hairHex = '#92400E'; // 琥珀金棕毛发
  } else if (type === 'nezha') {
    // 灵珠化身 / 莲花哪吒: 白皙粉润玉肌、大红金边肚兜、碧翠荷叶短裳、纯金乾坤圈、赤红红绣履
    skinHex = '#FED7AA';
    topHex = '#E11D48'; // 烈火朱红肚兜
    bottomHex = '#059669'; // 碧翠荷叶短裳
    accentHex = '#F59E0B'; // 纯金乾坤项圈与手镯
    shoesHex = '#DC2626'; // 莲花红绣履
    hairHex = '#09090B'; // 乌黑发丝
  } else if (type === 'guofeng_hero') {
    // 国潮少侠 / 少年剑客: 温润玉色、月白汉服交领、玄黑剑裤、赤红剑带
    skinHex = '#FDE68A';
    topHex = '#F8FAFC'; // 月白织锦
    bottomHex = '#0F172A'; // 玄黑行脚
    accentHex = '#DC2626'; // 丹砂朱红发带
    shoesHex = '#18181B'; // 千层底布鞋
    hairHex = '#09090B'; // 水墨纯黑
  } else if (type === 'panda_hero') {
    // 功夫国宝 / 熊猫大侠: 纯白毛绒躯干、大红功夫肚兜、玄黑武术裤、金腰带
    skinHex = '#FFFFFF';
    topHex = '#E11D48'; // 烈火朱砂红
    bottomHex = '#0F172A';
    accentHex = '#FBBF24'; // 功夫金带
    shoesHex = '#0F172A';
    hairHex = '#0F172A'; // 纯黑圆耳与眼圈
  } else if (type === 'chibi_ninja') {
    topHex = '#1E222D';
    bottomHex = '#0F172A';
    accentHex = '#DC2626'; // Vibrant red ninja headband
    shoesHex = '#0B0F19';
    hairHex = '#111827';
  } else if (type === 'beach_dude') {
    topHex = '#F59E0B'; // Hawaiian warm yellow
    bottomHex = '#06B6D4'; // Cyan swim trunks
    accentHex = '#10B981';
    hairHex = '#EAB308'; // Blonde
    shoesHex = '#EA580C';
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
    skin: new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.38 }),
    clothTop: new THREE.MeshStandardMaterial({ color: topHex, roughness: 0.35 }),
    clothBottom: new THREE.MeshStandardMaterial({ color: bottomHex, roughness: 0.42 }),
    accent: new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.28 }),
    shoes: new THREE.MeshStandardMaterial({ color: shoesHex, roughness: 0.35 }),
    hair: new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.45 }),
    eyes: new THREE.MeshBasicMaterial({ color: '#0F172A' }),
  };

  // 1. Root & Torso Group
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.72, 0);
  root.add(torsoGroup);

  // Dynamic ribbons, plumes, and silks that sway in the wind
  const headbandRibbons: THREE.Mesh[] = [];

  // Pelvis / Running Shorts
  const pelvisGeo = new THREE.CylinderGeometry(0.33, 0.3, 0.32, 8);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, materials.clothBottom);
  pelvisMesh.position.y = 0.16;
  pelvisMesh.castShadow = true;
  torsoGroup.add(pelvisMesh);

  // Shorts Athletic Side Stripes
  if (type !== 'stickman') {
    const stripeMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const stripeGeo = new THREE.BoxGeometry(0.04, 0.24, 0.32);
    const stripeL = new THREE.Mesh(stripeGeo, stripeMat);
    stripeL.position.set(-0.32, 0.16, 0);
    torsoGroup.add(stripeL);
    const stripeR = new THREE.Mesh(stripeGeo, stripeMat);
    stripeR.position.set(0.32, 0.16, 0);
    torsoGroup.add(stripeR);
  }

  // Athletic Chest & Jersey
  const chestGeo = new THREE.CylinderGeometry(0.38, 0.32, 0.54, 8);
  const chestMesh = new THREE.Mesh(chestGeo, materials.clothTop);
  chestMesh.position.y = 0.55;
  chestMesh.castShadow = true;
  torsoGroup.add(chestMesh);

  // Jersey collar / Hanfu collar
  if (type !== 'stickman') {
    const collarColor =
      type === 'wukong' || type === 'guofeng_hero' || type === 'nezha' ? '#DC2626' : '#FFFFFF';
    const collarGeo = new THREE.TorusGeometry(0.24, 0.035, 6, 12);
    collarGeo.rotateX(Math.PI / 2);
    const collarMat = new THREE.MeshBasicMaterial({ color: collarColor });
    const collarMesh = new THREE.Mesh(collarGeo, collarMat);
    collarMesh.position.set(0, 0.81, 0.05);
    torsoGroup.add(collarMesh);
  }

  // Chest Attire: Bib for modern runners, Golden Breastplate for Wukong, Hanfu Lapel for Swordsman, Qiankun Ring for Nezha
  if (type === 'wukong') {
    // 黄金锁子护心甲
    const armorGeo = new THREE.BoxGeometry(0.28, 0.28, 0.06);
    const armorMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      metalness: 0.85,
      roughness: 0.2,
    });
    const armorMesh = new THREE.Mesh(armorGeo, armorMat);
    armorMesh.position.set(0, 0.58, 0.35);
    torsoGroup.add(armorMesh);

    // 金甲中心兽面浮雕微盘
    const emblemGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8);
    emblemGeo.rotateX(Math.PI / 2);
    const emblemMat = new THREE.MeshStandardMaterial({ color: '#DC2626', metalness: 0.5 });
    const emblemMesh = new THREE.Mesh(emblemGeo, emblemMat);
    emblemMesh.position.set(0, 0.58, 0.385);
    torsoGroup.add(emblemMesh);

    // 齐天大圣 战甲下摆/战袍龙鳞裙 (Battle Tassets & War Skirt)
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.4 });
    const goldTrimMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.9, roughness: 0.18 });

    // 前襟战袍甲裙
    const frontSkirtGeo = new THREE.BoxGeometry(0.3, 0.28, 0.05);
    const frontSkirt = new THREE.Mesh(frontSkirtGeo, skirtMat);
    frontSkirt.position.set(0, 0.2, 0.2);
    frontSkirt.rotation.x = 0.18;
    torsoGroup.add(frontSkirt);

    // 金边祥云腰牌
    const buckleGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8);
    buckleGeo.rotateX(Math.PI / 2);
    const buckle = new THREE.Mesh(buckleGeo, goldTrimMat);
    buckle.position.set(0, 0.34, 0.32);
    torsoGroup.add(buckle);

    // 两侧战甲护胯裙片
    for (const sx of [-1, 1]) {
      const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.24), goldTrimMat);
      sideSkirt.position.set(sx * 0.24, 0.18, 0);
      sideSkirt.rotation.z = sx * 0.18;
      torsoGroup.add(sideSkirt);
    }
  } else if (type === 'nezha') {
    // 纯金乾坤圈: 斜挎胸前环绕，金光闪烁
    const ringGeo = new THREE.TorusGeometry(0.26, 0.032, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      metalness: 0.95,
      roughness: 0.12,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 0.58, 0.22);
    ringMesh.rotation.x = 0.35;
    ringMesh.rotation.y = 0.45;
    torsoGroup.add(ringMesh);

    // 混天绫: 仙家赤红丝帛披帛，绕肩并在身后延展两条灵动长飘带
    const silkMat = new THREE.MeshStandardMaterial({
      color: '#DC2626',
      roughness: 0.3,
      side: THREE.DoubleSide,
    });

    // 绕肩横拱
    const silkArchGeo = new THREE.TorusGeometry(0.42, 0.04, 6, 16, Math.PI);
    const silkArch = new THREE.Mesh(silkArchGeo, silkMat);
    silkArch.position.set(0, 0.72, -0.1);
    silkArch.rotation.x = -Math.PI / 3;
    torsoGroup.add(silkArch);

    // 混天绫左长仙飘带 (随风后展)
    const silkGeoL = new THREE.BoxGeometry(0.12, 0.02, 1.05);
    silkGeoL.translate(0, 0, -0.52);
    const silkMeshL = new THREE.Mesh(silkGeoL, silkMat);
    silkMeshL.position.set(-0.32, 0.65, -0.15);
    silkMeshL.rotation.y = -0.22;
    silkMeshL.rotation.x = -0.2;
    torsoGroup.add(silkMeshL);
    headbandRibbons.push(silkMeshL);

    // 混天绫右长仙飘带
    const silkGeoR = new THREE.BoxGeometry(0.12, 0.02, 1.05);
    silkGeoR.translate(0, 0, -0.52);
    const silkMeshR = new THREE.Mesh(silkGeoR, silkMat);
    silkMeshR.position.set(0.32, 0.65, -0.15);
    silkMeshR.rotation.y = 0.22;
    silkMeshR.rotation.x = -0.2;
    torsoGroup.add(silkMeshR);
    headbandRibbons.push(silkMeshR);

    // 莲花红肚兜金边
    const lotusBorderGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.24, 6, 1, true);
    const lotusBorderMat = new THREE.MeshBasicMaterial({ color: '#F59E0B' });
    const lotusBorder = new THREE.Mesh(lotusBorderGeo, lotusBorderMat);
    lotusBorder.position.set(0, 0.52, 0.16);
    torsoGroup.add(lotusBorder);
  } else if (type === 'guofeng_hero') {
    // 汉服右衽斜襟交领饰条
    const lapelGeo = new THREE.PlaneGeometry(0.3, 0.32);
    const lapelMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide });
    const lapelMesh = new THREE.Mesh(lapelGeo, lapelMat);
    lapelMesh.position.set(0.02, 0.58, 0.355);
    lapelMesh.rotation.z = -0.35;
    torsoGroup.add(lapelMesh);

    // 朱砂红腰封细带
    const sashGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.08, 10, 1, true);
    const sashMat = new THREE.MeshBasicMaterial({ color: '#DC2626' });
    const sashMesh = new THREE.Mesh(sashGeo, sashMat);
    sashMesh.position.set(0, 0.34, 0);
    torsoGroup.add(sashMesh);
  } else if (type === 'panda_hero') {
    // 功夫练功肚兜金色祥云印记
    const emblemGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8);
    emblemGeo.rotateX(Math.PI / 2);
    const emblemMat = new THREE.MeshBasicMaterial({ color: '#FBBF24' });
    const emblemMesh = new THREE.Mesh(emblemGeo, emblemMat);
    emblemMesh.position.set(0, 0.56, 0.355);
    torsoGroup.add(emblemMesh);
  } else if (type !== 'stickman') {
    const bibGeo = new THREE.PlaneGeometry(0.26, 0.22);
    const bibMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide });
    const bibMesh = new THREE.Mesh(bibGeo, bibMat);
    bibMesh.position.set(0, 0.56, 0.36);
    torsoGroup.add(bibMesh);

    // Number Graphic
    const numGeo = new THREE.PlaneGeometry(0.12, 0.13);
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

  // Stylized Chibi Head
  const headGeo = new THREE.SphereGeometry(0.32, 14, 12);
  const headMesh = new THREE.Mesh(headGeo, materials.skin);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  let hairGroup: THREE.Group | undefined;

  if (type !== 'stickman') {
    // A. Expressive Eyes with Sparkles
    const eyeWhiteGeo = new THREE.SphereGeometry(0.085, 8, 8);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });

    const pupilGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#0F172A' });

    const catchGeo = new THREE.SphereGeometry(0.022, 6, 6);
    const catchMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });

    // Left Eye
    const eyeWhiteL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeWhiteL.scale.set(0.9, 1.25, 0.4);
    eyeWhiteL.position.set(-0.125, 0.04, 0.28);
    eyeWhiteL.rotation.y = 0.12;
    headGroup.add(eyeWhiteL);

    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.scale.set(0.85, 1.1, 0.3);
    pupilL.position.set(-0.12, 0.04, 0.305);
    headGroup.add(pupilL);

    const catchL = new THREE.Mesh(catchGeo, catchMat);
    catchL.position.set(-0.1, 0.075, 0.32);
    headGroup.add(catchL);

    // Right Eye
    const eyeWhiteR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeWhiteR.scale.set(0.9, 1.25, 0.4);
    eyeWhiteR.position.set(0.125, 0.04, 0.28);
    eyeWhiteR.rotation.y = -0.12;
    headGroup.add(eyeWhiteR);

    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.scale.set(0.85, 1.1, 0.3);
    pupilR.position.set(0.12, 0.04, 0.305);
    headGroup.add(pupilR);

    const catchR = new THREE.Mesh(catchGeo, catchMat);
    catchR.position.set(0.14, 0.075, 0.32);
    headGroup.add(catchR);

    // B. Rosy Blushing Cheeks (Adds life and personality)
    const blushGeo = new THREE.PlaneGeometry(0.11, 0.06);
    const blushMat = new THREE.MeshBasicMaterial({
      color: '#FB7185',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.19, -0.06, 0.25);
    blushL.rotation.y = 0.55;
    headGroup.add(blushL);

    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(0.19, -0.06, 0.25);
    blushR.rotation.y = -0.55;
    headGroup.add(blushR);

    // Panda Hero Iconic Eye Patches & Cute Black Nose
    if (type === 'panda_hero') {
      const patchGeo = new THREE.SphereGeometry(0.088, 8, 8);
      const patchMat = new THREE.MeshBasicMaterial({ color: '#0F172A' });
      const patchL = new THREE.Mesh(patchGeo, patchMat);
      patchL.scale.set(1.15, 1.35, 0.35);
      patchL.position.set(-0.125, 0.04, 0.275);
      patchL.rotation.z = -0.22;
      headGroup.add(patchL);

      const patchR = new THREE.Mesh(patchGeo, patchMat);
      patchR.scale.set(1.15, 1.35, 0.35);
      patchR.position.set(0.125, 0.04, 0.275);
      patchR.rotation.z = 0.22;
      headGroup.add(patchR);

      // Black panda button nose
      const noseGeo = new THREE.SphereGeometry(0.038, 6, 6);
      const noseMat = new THREE.MeshBasicMaterial({ color: '#0F172A' });
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.scale.set(1.2, 0.8, 0.8);
      nose.position.set(0, -0.045, 0.32);
      headGroup.add(nose);
    }

    if (type === 'nezha') {
      // 哪吒额前朱砂神火印 (Divine Fire Vermilion Mark)
      const markGeo = new THREE.ConeGeometry(0.038, 0.09, 4);
      const markMat = new THREE.MeshBasicMaterial({ color: '#DC2626' });
      const mark = new THREE.Mesh(markGeo, markMat);
      mark.position.set(0, 0.13, 0.34);
      mark.rotation.x = 0.22;
      headGroup.add(mark);
    }

    // C. Confident Runner Smile
    const smileGeo = new THREE.TorusGeometry(0.065, 0.016, 4, 8, Math.PI);
    smileGeo.rotateX(Math.PI);
    const smileMat = new THREE.MeshBasicMaterial({ color: '#991B1B' });
    const smileMesh = new THREE.Mesh(smileGeo, smileMat);
    smileMesh.position.set(0, -0.12, 0.29);
    smileMesh.rotation.x = -0.2;
    headGroup.add(smileMesh);

    // D. Volumetric Clustered Spiky Hair
    hairGroup = new THREE.Group();
    headGroup.add(hairGroup);

    if (type === 'runner_boy' || type === 'beach_dude') {
      // Main Hair Volume (Crown back)
      const crownGeo = new THREE.ConeGeometry(0.36, 0.42, 7);
      const crownMesh = new THREE.Mesh(crownGeo, materials.hair);
      crownMesh.position.set(0, 0.22, -0.05);
      crownMesh.rotation.x = -0.32;
      hairGroup.add(crownMesh);

      // Top Wind-Swept Spikes
      const spikeGeo1 = new THREE.ConeGeometry(0.14, 0.35, 5);
      spikeGeo1.rotateX(-0.5);
      const spike1 = new THREE.Mesh(spikeGeo1, materials.hair);
      spike1.position.set(-0.1, 0.32, -0.02);
      hairGroup.add(spike1);

      const spike2 = new THREE.Mesh(spikeGeo1, materials.hair);
      spike2.position.set(0.1, 0.33, -0.04);
      spike2.rotation.z = -0.2;
      hairGroup.add(spike2);

      const spike3 = new THREE.Mesh(spikeGeo1, materials.hair);
      spike3.position.set(0, 0.36, -0.12);
      spike3.rotation.x = -0.4;
      hairGroup.add(spike3);

      // Layered Front Fringe Bangs
      const bangGeo = new THREE.BoxGeometry(0.34, 0.14, 0.2);
      const bangMesh = new THREE.Mesh(bangGeo, materials.hair);
      bangMesh.position.set(0, 0.25, 0.16);
      bangMesh.rotation.x = 0.32;
      hairGroup.add(bangMesh);

      // Temple Side Tufts
      const tuftGeo = new THREE.ConeGeometry(0.12, 0.28, 5);
      tuftGeo.rotateZ(0.6);
      const tuftL = new THREE.Mesh(tuftGeo, materials.hair);
      tuftL.position.set(-0.25, 0.12, 0.05);
      hairGroup.add(tuftL);

      const tuftR = new THREE.Mesh(tuftGeo, materials.hair);
      tuftR.rotation.y = Math.PI;
      tuftR.position.set(0.25, 0.12, 0.05);
      hairGroup.add(tuftR);

      // Athletic Headband with Emblem Badge
      const bandGeo = new THREE.CylinderGeometry(0.338, 0.338, 0.11, 14, 1, true);
      const bandMesh = new THREE.Mesh(bandGeo, materials.accent);
      bandMesh.position.y = 0.1;
      headGroup.add(bandMesh);

      const badgeGeo = new THREE.BoxGeometry(0.09, 0.09, 0.04);
      const badgeMat = new THREE.MeshStandardMaterial({ color: '#FCD34D', metalness: 0.6, roughness: 0.2 });
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.set(0, 0.1, 0.335);
      headGroup.add(badgeMesh);

      // Dual Wind-Fluttering Ribbon Tails at back of head
      const ribGeo1 = new THREE.BoxGeometry(0.12, 0.035, 0.58);
      ribGeo1.translate(0, 0, -0.28);
      const rib1 = new THREE.Mesh(ribGeo1, materials.accent);
      rib1.position.set(-0.05, 0.11, -0.32);
      headGroup.add(rib1);
      headbandRibbons.push(rib1);

      const ribGeo2 = new THREE.BoxGeometry(0.11, 0.032, 0.52);
      ribGeo2.translate(0, 0, -0.25);
      const rib2 = new THREE.Mesh(ribGeo2, materials.accent);
      rib2.position.set(0.05, 0.09, -0.32);
      headGroup.add(rib2);
      headbandRibbons.push(rib2);
    } else if (type === 'chibi_ninja') {
      // Ninja Hood
      const hoodGeo = new THREE.SphereGeometry(0.348, 12, 10);
      const hoodMesh = new THREE.Mesh(hoodGeo, materials.clothTop);
      hoodMesh.position.set(0, 0.02, -0.02);
      headGroup.add(hoodMesh);

      // Red Ninja Headband Ribbon
      const bandGeo = new THREE.CylinderGeometry(0.352, 0.352, 0.12, 14, 1, true);
      const bandMesh = new THREE.Mesh(bandGeo, materials.accent);
      bandMesh.position.y = 0.1;
      headGroup.add(bandMesh);

      // Silver Shinobi Forehead Plate
      const plateGeo = new THREE.BoxGeometry(0.18, 0.08, 0.03);
      const plateMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', metalness: 0.8, roughness: 0.2 });
      const plateMesh = new THREE.Mesh(plateGeo, plateMat);
      plateMesh.position.set(0, 0.1, 0.35);
      headGroup.add(plateMesh);

      // Long Fluttering Ninja Ribbon Tails
      const ribGeo1 = new THREE.BoxGeometry(0.14, 0.035, 0.78);
      ribGeo1.translate(0, 0, -0.38);
      const rib1 = new THREE.Mesh(ribGeo1, materials.accent);
      rib1.position.set(-0.06, 0.11, -0.34);
      headGroup.add(rib1);
      headbandRibbons.push(rib1);

      const ribGeo2 = new THREE.BoxGeometry(0.13, 0.032, 0.72);
      ribGeo2.translate(0, 0, -0.35);
      const rib2 = new THREE.Mesh(ribGeo2, materials.accent);
      rib2.position.set(0.06, 0.09, -0.34);
      headGroup.add(rib2);
      headbandRibbons.push(rib2);
    } else if (type === 'voxel_bot') {
      // Cyber Glowing Visor
      const visorGeo = new THREE.BoxGeometry(0.5, 0.18, 0.24);
      const visorMat = new THREE.MeshStandardMaterial({
        color: '#06B6D4',
        roughness: 0.1,
        emissive: new THREE.Color('#0891B2'),
        emissiveIntensity: 0.6,
      });
      const visorMesh = new THREE.Mesh(visorGeo, visorMat);
      visorMesh.position.set(0, 0.06, 0.22);
      headGroup.add(visorMesh);

      // Cyber Antenna
      const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
      const antMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', metalness: 0.5 });
      const antMesh = new THREE.Mesh(antGeo, antMat);
      antMesh.position.set(0.24, 0.36, -0.05);
      antMesh.rotation.z = -0.3;
      headGroup.add(antMesh);
    } else if (type === 'wukong') {
      // 齐天大圣 / 美猴王: 紧箍咒、凤翅紫金冠雉翎双飘带、金色毛发鬃毛
      const crownGeo = new THREE.ConeGeometry(0.38, 0.44, 7);
      const crownMesh = new THREE.Mesh(crownGeo, materials.hair);
      crownMesh.position.set(0, 0.22, -0.06);
      crownMesh.rotation.x = -0.32;
      hairGroup.add(crownMesh);

      // 金毛发簇
      const spikeGeo = new THREE.ConeGeometry(0.12, 0.36, 5);
      const spike1 = new THREE.Mesh(spikeGeo, materials.hair);
      spike1.position.set(-0.1, 0.34, -0.02);
      spike1.rotation.z = 0.2;
      hairGroup.add(spike1);

      const spike2 = new THREE.Mesh(spikeGeo, materials.hair);
      spike2.position.set(0.1, 0.35, -0.02);
      spike2.rotation.z = -0.2;
      hairGroup.add(spike2);

      const spike3 = new THREE.Mesh(spikeGeo, materials.hair);
      spike3.position.set(0, 0.38, -0.1);
      spike3.rotation.x = -0.4;
      hairGroup.add(spike3);

      // 紧箍圈 (Golden Circlet)
      const circletGeo = new THREE.TorusGeometry(0.34, 0.026, 8, 20);
      circletGeo.rotateX(Math.PI / 2);
      const circletMat = new THREE.MeshStandardMaterial({
        color: '#F59E0B',
        metalness: 0.92,
        roughness: 0.15,
      });
      const circletMesh = new THREE.Mesh(circletGeo, circletMat);
      circletMesh.position.set(0, 0.1, 0.02);
      headGroup.add(circletMesh);

      // 额前紧箍祥云月牙饰件
      const curlGeo = new THREE.TorusGeometry(0.055, 0.018, 6, 12, Math.PI * 1.4);
      const curlMesh = new THREE.Mesh(curlGeo, circletMat);
      curlMesh.position.set(0, 0.13, 0.35);
      curlMesh.rotation.z = Math.PI;
      headGroup.add(curlMesh);

      // 凤翅紫金冠 - 双雉鸡翎超长灵动翎羽 (Fluttering Phoenix Plumes)
      const plumeMat = new THREE.MeshStandardMaterial({
        color: '#DC2626',
        roughness: 0.3,
      });

      const plumeGeoL = new THREE.BoxGeometry(0.08, 0.025, 0.95);
      plumeGeoL.translate(0, 0, -0.48);
      const plumeL = new THREE.Mesh(plumeGeoL, plumeMat);
      plumeL.position.set(-0.08, 0.25, -0.25);
      plumeL.rotation.y = -0.15;
      plumeL.rotation.x = -0.25;
      headGroup.add(plumeL);
      headbandRibbons.push(plumeL);

      const plumeGeoR = new THREE.BoxGeometry(0.08, 0.025, 0.95);
      plumeGeoR.translate(0, 0, -0.48);
      const plumeR = new THREE.Mesh(plumeGeoR, plumeMat);
      plumeR.position.set(0.08, 0.25, -0.25);
      plumeR.rotation.y = 0.15;
      plumeR.rotation.x = -0.25;
      headGroup.add(plumeR);
      headbandRibbons.push(plumeR);
    } else if (type === 'guofeng_hero') {
      // 国潮少侠 / 少年剑客: 高马尾发髻、红丝发带、水墨鬓发
      const bunBaseGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.15, 8);
      const bunBase = new THREE.Mesh(bunBaseGeo, materials.hair);
      bunBase.position.set(0, 0.35, -0.1);
      bunBase.rotation.x = -0.3;
      hairGroup.add(bunBase);

      // 高耸马尾束发
      const ponyGeo = new THREE.ConeGeometry(0.14, 0.46, 7);
      ponyGeo.rotateX(-Math.PI / 2.5);
      const ponyMesh = new THREE.Mesh(ponyGeo, materials.hair);
      ponyMesh.position.set(0, 0.42, -0.25);
      hairGroup.add(ponyMesh);

      // 朱红发带发箍
      const ribbonBandGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8);
      const ribbonBand = new THREE.Mesh(ribbonBandGeo, materials.accent);
      ribbonBand.position.set(0, 0.41, -0.12);
      hairGroup.add(ribbonBand);

      // 飘逸剑侠红发带 (随风后摆)
      const ribGeo1 = new THREE.BoxGeometry(0.09, 0.025, 0.85);
      ribGeo1.translate(0, 0, -0.42);
      const rib1 = new THREE.Mesh(ribGeo1, materials.accent);
      rib1.position.set(-0.04, 0.38, -0.15);
      headGroup.add(rib1);
      headbandRibbons.push(rib1);

      const ribGeo2 = new THREE.BoxGeometry(0.08, 0.022, 0.78);
      ribGeo2.translate(0, 0, -0.38);
      const rib2 = new THREE.Mesh(ribGeo2, materials.accent);
      rib2.position.set(0.04, 0.36, -0.15);
      headGroup.add(rib2);
      headbandRibbons.push(rib2);

      // 额前刘海与两鬓青丝
      const fringeGeo = new THREE.BoxGeometry(0.3, 0.1, 0.16);
      const fringe = new THREE.Mesh(fringeGeo, materials.hair);
      fringe.position.set(0, 0.26, 0.2);
      fringe.rotation.x = 0.3;
      hairGroup.add(fringe);

      const sideLockL = new THREE.CylinderGeometry(0.03, 0.015, 0.3, 5);
      const lockL = new THREE.Mesh(sideLockL, materials.hair);
      lockL.position.set(-0.28, 0.02, 0.12);
      lockL.rotation.z = -0.1;
      hairGroup.add(lockL);

      const sideLockR = new THREE.CylinderGeometry(0.03, 0.015, 0.3, 5);
      const lockR = new THREE.Mesh(sideLockR, materials.hair);
      lockR.position.set(0.28, 0.02, 0.12);
      lockR.rotation.z = 0.1;
      hairGroup.add(lockR);
    } else if (type === 'nezha') {
      // 灵珠哪吒: 经典双丸子冲天抓髻 (双包包头) + 束发红带与额前齐刘海
      const bunGeo = new THREE.SphereGeometry(0.135, 8, 8);

      // 左丸子
      const bunL = new THREE.Mesh(bunGeo, materials.hair);
      bunL.position.set(-0.24, 0.32, 0.02);
      hairGroup.add(bunL);

      // 右丸子
      const bunR = new THREE.Mesh(bunGeo, materials.hair);
      bunR.position.set(0.24, 0.32, 0.02);
      hairGroup.add(bunR);

      // 束发红发绳
      const tieGeo = new THREE.TorusGeometry(0.11, 0.024, 6, 12);
      const tieMat = new THREE.MeshBasicMaterial({ color: '#DC2626' });
      const tieL = new THREE.Mesh(tieGeo, tieMat);
      tieL.position.set(-0.24, 0.26, 0.02);
      tieL.rotation.x = Math.PI / 2;
      hairGroup.add(tieL);

      const tieR = new THREE.Mesh(tieGeo, tieMat);
      tieR.position.set(0.24, 0.26, 0.02);
      tieR.rotation.x = Math.PI / 2;
      hairGroup.add(tieR);

      // 双丸子垂下的红发带
      const ribGeoL = new THREE.BoxGeometry(0.065, 0.02, 0.65);
      ribGeoL.translate(0, 0, -0.32);
      const ribL = new THREE.Mesh(ribGeoL, tieMat);
      ribL.position.set(-0.25, 0.26, -0.05);
      ribL.rotation.y = -0.2;
      headGroup.add(ribL);
      headbandRibbons.push(ribL);

      const ribGeoR = new THREE.BoxGeometry(0.065, 0.02, 0.65);
      ribGeoR.translate(0, 0, -0.32);
      const ribR = new THREE.Mesh(ribGeoR, tieMat);
      ribR.position.set(0.25, 0.26, -0.05);
      ribR.rotation.y = 0.2;
      headGroup.add(ribR);
      headbandRibbons.push(ribR);

      // 额前灵动齐刘海
      const bangsGeo = new THREE.BoxGeometry(0.28, 0.09, 0.13);
      const bangs = new THREE.Mesh(bangsGeo, materials.hair);
      bangs.position.set(0, 0.24, 0.24);
      bangs.rotation.x = 0.28;
      hairGroup.add(bangs);
    } else if (type === 'panda_hero') {
      // 功夫国宝 / 熊猫大侠: 呆萌圆黑耳
      const earGeo = new THREE.SphereGeometry(0.095, 8, 8);
      const earMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.6 });

      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(-0.25, 0.28, 0.02);
      headGroup.add(earL);

      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(0.25, 0.28, 0.02);
      headGroup.add(earR);

      // 功夫红色发绳
      const kungfuHeadbandGeo = new THREE.CylinderGeometry(0.342, 0.342, 0.06, 12, 1, true);
      const kungfuHeadband = new THREE.Mesh(kungfuHeadbandGeo, materials.clothTop);
      kungfuHeadband.position.y = 0.14;
      headGroup.add(kungfuHeadband);

      // 小巧红结
      const knotGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
      const knot = new THREE.Mesh(knotGeo, materials.accent);
      knot.position.set(0, 0.14, 0.35);
      headGroup.add(knot);
    }
  }

  // 3. Articulated Legs (Hip -> Thigh -> Knee -> Calf -> Sneaker with Sole & Laces)
  const createLeg = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;

    // Hip Joint Group
    const hip = new THREE.Group();
    hip.position.set(side * 0.2, 0.08, 0);
    torsoGroup.add(hip);

    // Thigh with athletic muscle taper
    const thighGeo = new THREE.CylinderGeometry(0.12, 0.095, 0.38, 7);
    thighGeo.translate(0, -0.19, 0);
    const thighMesh = new THREE.Mesh(thighGeo, materials.clothBottom);
    thighMesh.castShadow = true;
    hip.add(thighMesh);

    // Knee Joint Group (bends backwards)
    const knee = new THREE.Group();
    knee.position.set(0, -0.38, 0);
    hip.add(knee);

    // Calf / Shin
    const calfGeo = new THREE.CylinderGeometry(0.095, 0.08, 0.38, 7);
    calfGeo.translate(0, -0.19, 0);
    const calfMat =
      type === 'guofeng_hero' || type === 'panda_hero' || type === 'wukong' || type === 'chibi_ninja'
        ? materials.clothBottom
        : materials.skin;
    const calfMesh = new THREE.Mesh(calfGeo, calfMat);
    calfMesh.castShadow = true;
    knee.add(calfMesh);

    // Ankle / Foot Group (Allows natural Foot-Roll Heel/Toe pitch)
    const foot = new THREE.Group();
    foot.position.set(0, -0.36, 0.04);
    knee.add(foot);

    // Running Sneaker / Chinese Kung Fu Shoes / Cloud Boots Body
    const shoeGeo = new THREE.BoxGeometry(0.19, 0.15, 0.34);
    shoeGeo.translate(0, -0.065, 0.04);
    const shoeMesh = new THREE.Mesh(shoeGeo, materials.shoes);
    shoeMesh.castShadow = true;
    foot.add(shoeMesh);

    // Sneaker Laces & Tongue Accent (Only modern runners)
    const isChinese =
      type === 'wukong' || type === 'nezha' || type === 'guofeng_hero' || type === 'panda_hero';
    if (type !== 'stickman' && !isChinese) {
      const laceGeo = new THREE.PlaneGeometry(0.14, 0.16);
      const laceMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide });
      const laceMesh = new THREE.Mesh(laceGeo, laceMat);
      laceMesh.position.set(0, 0.015, 0.08);
      laceMesh.rotation.x = -Math.PI / 3;
      foot.add(laceMesh);
    } else if (type === 'wukong') {
      // 藕丝步云履金边卷头
      const toeGeo = new THREE.BoxGeometry(0.18, 0.08, 0.08);
      const toeMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.8, roughness: 0.2 });
      const toeMesh = new THREE.Mesh(toeGeo, toeMat);
      toeMesh.position.set(0, -0.04, 0.2);
      foot.add(toeMesh);
    } else if (type === 'nezha') {
      // 哪吒脚腕纯金乾坤金刚镯
      const ankletGeo = new THREE.TorusGeometry(0.1, 0.022, 6, 14);
      ankletGeo.rotateX(Math.PI / 2);
      const ankletMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.92, roughness: 0.15 });
      const anklet = new THREE.Mesh(ankletGeo, ankletMat);
      anklet.position.set(0, 0.04, 0.04);
      foot.add(anklet);
    }

    // High-Contrast White Rubber Sneaker Midsole / Traditional Kung Fu White Sole (千层底白边)
    const soleGeo = new THREE.BoxGeometry(0.205, 0.065, 0.36);
    soleGeo.translate(0, -0.135, 0.04);
    const soleMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const soleMesh = new THREE.Mesh(soleGeo, soleMat);
    foot.add(soleMesh);

    // Heel Bumper Reflector Tab
    if (type !== 'stickman' && !isChinese) {
      const heelGeo = new THREE.BoxGeometry(0.14, 0.06, 0.03);
      const heelMat = new THREE.MeshBasicMaterial({ color: accentHex });
      const heelMesh = new THREE.Mesh(heelGeo, heelMat);
      heelMesh.position.set(0, -0.07, -0.135);
      foot.add(heelMesh);
    }

    return { hip, knee, foot };
  };

  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);

  // 4. Articulated Arms & Hands (Shoulder -> UpperArm -> Elbow -> Forearm -> Cupped Hand)
  // Anatomically positioned to naturally support and cradle the carried wood planks!
  const createArm = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;

    // Shoulder Joint
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.42, 0.72, 0);
    torsoGroup.add(shoulder);

    // Shoulder Cap (Sleeveless tank muscle)
    const capGeo = new THREE.SphereGeometry(0.1, 7, 7);
    const capMesh = new THREE.Mesh(capGeo, materials.skin);
    shoulder.add(capMesh);

    // 齐天大圣 凤翅金甲护肩 / 兽面肩吞
    if (type === 'wukong') {
      const pauldronGeo = new THREE.SphereGeometry(0.16, 8, 8);
      pauldronGeo.scale(1.2, 0.7, 1.1);
      const pauldronMat = new THREE.MeshStandardMaterial({
        color: '#F59E0B',
        metalness: 0.9,
        roughness: 0.15,
      });
      const pauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
      pauldron.position.set(side * 0.05, 0.06, 0);
      shoulder.add(pauldron);

      const wingGeo = new THREE.BoxGeometry(0.14, 0.04, 0.22);
      const wingMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.3 });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * 0.1, 0.09, 0);
      wing.rotation.z = side * 0.35;
      shoulder.add(wing);
    }

    // Upper Arm
    const upperGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.34, 7);
    upperGeo.translate(0, -0.17, 0);
    const upperMesh = new THREE.Mesh(upperGeo, materials.skin);
    upperMesh.castShadow = true;
    shoulder.add(upperMesh);

    // Elbow Joint
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.32, 0);
    shoulder.add(elbow);

    // Forearm reaching forward to cradle planks
    const foreGeo = new THREE.CylinderGeometry(0.082, 0.072, 0.34, 7);
    foreGeo.translate(0, 0, 0.17); // forward in Z
    foreGeo.rotateX(Math.PI / 2);
    const foreMesh = new THREE.Mesh(foreGeo, materials.skin);
    foreMesh.castShadow = true;
    elbow.add(foreMesh);

    // Hand Group with Palm, Thumb & Curved Fingers (Visually holding the load!)
    const hand = new THREE.Group();
    hand.position.set(side * -0.04, -0.02, 0.35);
    elbow.add(hand);

    // 金手镯/护腕 (哪吒/孙悟空)
    if (type === 'nezha' || type === 'wukong') {
      const bangleGeo = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
      bangleGeo.rotateX(Math.PI / 2);
      const bangleMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.92, roughness: 0.15 });
      const bangle = new THREE.Mesh(bangleGeo, bangleMat);
      bangle.position.set(0, 0, 0.12);
      elbow.add(bangle);
    }

    // Palm Block
    const palmGeo = new THREE.BoxGeometry(0.13, 0.08, 0.12);
    const palmMesh = new THREE.Mesh(palmGeo, materials.skin);
    hand.add(palmMesh);

    // Cupped Upward Fingers supporting the wood base
    const fingersGeo = new THREE.BoxGeometry(0.12, 0.07, 0.08);
    fingersGeo.translate(0, 0.03, 0.05);
    const fingersMesh = new THREE.Mesh(fingersGeo, materials.skin);
    hand.add(fingersMesh);

    // Thumb gripping inside edge
    const thumbGeo = new THREE.BoxGeometry(0.05, 0.06, 0.08);
    thumbGeo.translate(side * 0.05, 0.04, 0);
    const thumbMesh = new THREE.Mesh(thumbGeo, materials.skin);
    hand.add(thumbMesh);

    return { shoulder, elbow, hand };
  };

  const leftArm = createArm(true);
  const rightArm = createArm(false);

  // 5. Plank Stack Mount Point
  // Positioned directly IN FRONT of the chest (Z: +0.62) cradled by hands, NEVER blocking the runner's back!
  const plankMount = new THREE.Group();
  plankMount.position.set(0, 0.58, 0.62);
  torsoGroup.add(plankMount);

  return {
    root,
    torso: torsoGroup,
    head: headGroup,
    hairGroup,
    headbandRibbons,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    plankMount,
    materials,
  };
}

/**
 * Procedural animation engine with authentic physics and game feel:
 * - Gait cycle with dynamic foot roll (Heel-strike to Toe-off)
 * - Heavy Load Balance: counterbalances stance and increases plank inertia as bundle grows
 * - Bridging Push Motion: rhythmic downward plank placement thrust
 * - Headwind Flutter: dual ribbon wave oscillation and subtle hair bounce
 * - High-speed steering banking & roll
 * - Pickup impact squash and stretch
 */
export function animateCharacter(
  char: ArticulatedCharacter,
  runCycle: number,
  steerVelocity: number,
  carriedPlanks: number,
  state: 'idle' | 'running' | 'bridging' | 'drowned' | 'finished',
  delta: number,
  pickupPulse: number = 0,
  bridgeThrowProgress: number = 0
) {
  if (state === 'drowned') {
    // Tumble and spin down into water
    char.root.rotation.x = THREE.MathUtils.lerp(char.root.rotation.x, Math.PI / 2, delta * 6);
    char.root.rotation.z = THREE.MathUtils.lerp(char.root.rotation.z, 0.6, delta * 5);
    char.torso.position.y = THREE.MathUtils.lerp(char.torso.position.y, -0.9, delta * 4);
    return;
  }

  if (state === 'finished') {
    // Grand victory cheering jump!
    char.torso.rotation.x = THREE.MathUtils.lerp(char.torso.rotation.x, -0.15, delta * 6);
    char.torso.rotation.z = 0;
    char.torso.position.y = 0.72 + Math.abs(Math.sin(runCycle * 4)) * 0.28;

    // Both arms raised high in triumph with victory wave
    char.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(char.leftArm.shoulder.rotation.x, -2.85, delta * 8);
    char.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(char.leftArm.shoulder.rotation.z, -0.45, delta * 8);
    char.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(char.leftArm.elbow.rotation.x, -0.2, delta * 8);

    char.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(char.rightArm.shoulder.rotation.x, -2.85, delta * 8);
    char.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(char.rightArm.shoulder.rotation.z, 0.45, delta * 8);
    char.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(char.rightArm.elbow.rotation.x, -0.2, delta * 8);

    // Legs celebratory bounce
    char.leftLeg.hip.rotation.x = 0;
    char.rightLeg.hip.rotation.x = 0;
    char.leftLeg.knee.rotation.x = 0.1;
    char.rightLeg.knee.rotation.x = 0.1;
    char.leftLeg.foot.rotation.x = 0;
    char.rightLeg.foot.rotation.x = 0;
    return;
  }

  // Active Running Gait:
  const stride = Math.sin(runCycle);
  const lift = Math.cos(runCycle);

  // 1. Heavy Load Physics Factor (0.0 to 1.0)
  // More planks = heavier stance, slight backward lean to counterbalance front load, deeper footsteps
  const loadFactor = Math.min(carriedPlanks / 25, 1.0);
  const counterBalanceLean = -loadFactor * 0.08; // lean back slightly against front weight

  // 2. Torso Dynamics
  // Sprint lean forward + load counterbalance + pickup pulse squash
  const baseLean = 0.18 + counterBalanceLean;
  const pulseSquash = pickupPulse * 0.08;
  char.torso.rotation.x = THREE.MathUtils.lerp(char.torso.rotation.x, baseLean + pulseSquash, delta * 15);

  // Torso twists with running strides
  char.torso.rotation.y = Math.sin(runCycle) * 0.08;

  // Banking / leaning into steer turns (VOODOO dynamic responsiveness)
  const targetRoll = -steerVelocity * 0.35;
  char.torso.rotation.z = THREE.MathUtils.lerp(char.torso.rotation.z, targetRoll, delta * 14);

  // Vertical step bounce (Bobbing) with impact compression
  char.torso.position.y = 0.72 + Math.abs(stride) * 0.12 - pulseSquash;

  // 3. Head Dynamics & Eye Tracking
  // Keep head level looking forward towards destination
  char.head.rotation.x = -char.torso.rotation.x * 0.75;
  char.head.rotation.y = -char.torso.rotation.y * 0.6;

  // Subtle hair micro-bounce
  if (char.hairGroup) {
    char.hairGroup.rotation.x = Math.sin(runCycle * 2) * 0.04;
    char.hairGroup.position.y = Math.abs(stride) * 0.02;
  }

  // Multi-Ribbon & Headband / Plumes Wave in Headwind
  if (char.headbandRibbons && char.headbandRibbons.length > 0) {
    const waveSpeed = runCycle * 2.8;
    for (let i = 0; i < char.headbandRibbons.length; i++) {
      const ribbon = char.headbandRibbons[i];
      const phase = (i * Math.PI) / 2;
      ribbon.rotation.x = -0.36 + Math.sin(waveSpeed + phase) * 0.22;
      ribbon.rotation.y = (i % 2 === 0 ? -1 : 1) * (0.16 + Math.cos(waveSpeed * 0.8 + phase) * 0.14);
    }
  }

  // 4. Stride Dynamics with Foot-Roll (Heel-Strike to Toe-Off)
  // Left Leg:
  char.leftLeg.hip.rotation.x = stride * 0.84;
  char.leftLeg.knee.rotation.x = stride > 0 ? 0.08 : Math.max(0, -stride * 1.38);

  // Left Foot roll: when swing forward (stride > 0), heel strikes up (+0.3); when kicking back, toe pitches down (-0.35)
  const footRollL = stride > 0 ? (stride > 0.4 ? 0.28 : -0.1) : -stride * 0.45;
  char.leftLeg.foot.rotation.x = THREE.MathUtils.lerp(char.leftLeg.foot.rotation.x, footRollL, delta * 16);

  // Right Leg:
  char.rightLeg.hip.rotation.x = -stride * 0.84;
  char.rightLeg.knee.rotation.x = -stride > 0 ? 0.08 : Math.max(0, stride * 1.38);

  // Right Foot roll:
  const footRollR = -stride > 0 ? (-stride > 0.4 ? 0.28 : -0.1) : stride * 0.45;
  char.rightLeg.foot.rotation.x = THREE.MathUtils.lerp(char.rightLeg.foot.rotation.x, footRollR, delta * 16);

  // 5. Arms, Carrying & Bridging Push Actions (单手环抱护垛 + 单手探前捞拾动态动作)
  const pickupPhase = Math.sin(Math.min(1.0, pickupPulse) * Math.PI); // 0 -> 1 -> 0 捞拾曲线
  const bridgeThrust = state === 'bridging' ? Math.sin(runCycle * 3.5) * 0.22 : 0;

  if (carriedPlanks > 0 || pickupPulse > 0.04) {
    // 左手：始终环抱、紧扣胸前砖垛（单手抱住物品）
    char.leftArm.shoulder.rotation.x = 0.65 + Math.sin(runCycle) * 0.04 + bridgeThrust;
    char.leftArm.shoulder.rotation.z = 0.38 + loadFactor * 0.1; // 往胸前内扣环抱
    char.leftArm.shoulder.rotation.y = -0.32;
    char.leftArm.elbow.rotation.x = -1.48 + bridgeThrust * 0.4; // 肘部弯曲90度横托在垛下
    char.leftArm.hand.rotation.x = -0.22;
    char.leftArm.hand.rotation.y = 0.35; // 掌心向上托住砖垛

    // 右手：如果有拾取触发（pickupPulse > 0.02），手臂大开大合下探捞拾；否则辅助扶持/摆臂
    if (pickupPulse > 0.02) {
      // 探手拾取动作：大臂向前下探、小臂向前探伸捞砖，随即回缩拍入砖垛
      char.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(0.48, 1.35, pickupPhase);
      char.rightArm.shoulder.rotation.y = THREE.MathUtils.lerp(0.22, -0.22, pickupPhase);
      char.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(-0.22, -0.42, pickupPhase);
      char.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(-1.25, -0.32, pickupPhase);
      char.rightArm.hand.rotation.x = THREE.MathUtils.lerp(-0.15, 0.55, pickupPhase);
    } else if (carriedPlanks > 0) {
      // 平常跑步抱着时：右手轻扶砖垛右侧，随跑步轻微呼吸浮动
      char.rightArm.shoulder.rotation.x = 0.48 - Math.sin(runCycle) * 0.08 + bridgeThrust;
      char.rightArm.shoulder.rotation.z = -0.22 - loadFactor * 0.08;
      char.rightArm.shoulder.rotation.y = 0.22;
      char.rightArm.elbow.rotation.x = -1.22 + bridgeThrust * 0.5;
      char.rightArm.hand.rotation.x = -0.15 + bridgeThrust;
    } else {
      char.rightArm.shoulder.rotation.x = stride * 0.85;
      char.rightArm.shoulder.rotation.z = -0.16;
      char.rightArm.shoulder.rotation.y = 0;
      char.rightArm.elbow.rotation.x = -0.65;
      char.rightArm.hand.rotation.x = 0;
    }
  } else {
    // 空手冲刺摆臂
    char.leftArm.shoulder.rotation.x = -stride * 0.85;
    char.leftArm.shoulder.rotation.z = 0.16;
    char.leftArm.shoulder.rotation.y = 0;
    char.leftArm.elbow.rotation.x = -0.65;
    char.leftArm.hand.rotation.x = 0;

    char.rightArm.shoulder.rotation.x = stride * 0.85;
    char.rightArm.shoulder.rotation.z = -0.16;
    char.rightArm.shoulder.rotation.y = 0;
    char.rightArm.elbow.rotation.x = -0.65;
    char.rightArm.hand.rotation.x = 0;
  }

  // 6. Planks Stack Inertia & Weight Lag (Tactile VOODOO Juice)
  // Higher bundle has more top-heavy inertia lag when turning left/right!
  const inertiaFactor = 0.4 + loadFactor * 0.4;
  const stackRoll = -steerVelocity * inertiaFactor;
  char.plankMount.rotation.z = THREE.MathUtils.lerp(char.plankMount.rotation.z, stackRoll, delta * 12);
  char.plankMount.rotation.x = 0.05 + Math.sin(runCycle * 2) * 0.04 - pulseSquash * 0.8;
  char.plankMount.rotation.y = Math.sin(runCycle) * 0.03;
}

