import { CharacterModelType, PlankStyleType } from '../types';

export interface MixamoAnimationClip {
  name: string;
  mixamoSource: string;
  duration: string;
  loop: boolean;
  fps: number;
  notes: string;
}

export interface ChineseAestheticPreset {
  id: CharacterModelType;
  name: string;
  englishName: string;
  tag: string;
  avatar: string;
  lore: string;
  description: string;
  signatureArtifacts: string[];
  recommendedPaletteId: string;
  recommendedPlankStyle: PlankStyleType;
  colors: {
    clothTop: string;
    clothBottom: string;
    accent: string;
    specialGold: string;
    skin: string;
  };
  fbxMetadata: {
    fileName: string;
    formatVersion: string;
    rigType: string;
    rootBone: string;
    totalBones: number;
    customBones: string[];
    geometry: {
      trianglesLOD0: number;
      trianglesLOD1: number;
      vertices: number;
      materialSlots: string[];
    };
    animationClips: MixamoAnimationClip[];
    cocosMetaConfig: Record<string, any>;
  };
}

export const CHINESE_AESTHETIC_PRESETS: ChineseAestheticPreset[] = [
  {
    id: 'wukong',
    name: '齐天大圣 · 孙悟空',
    englishName: 'Sun Wukong (The Monkey King)',
    tag: '神话第一顶流',
    avatar: '🐵',
    lore: '明代吴承恩《西游记》· 东方神话至尊战神',
    description: '头戴纯金紧箍与凤翅紫金冠，身着锁子黄金甲与大红战袍锦缎，脚踏藕丝步云履，奔跑冲刺威震四海。',
    signatureArtifacts: ['凤翅紫金冠双雉翎飘带', '纯金紧箍环', '锁子黄金甲护心镜', '藕丝步云履金边卷头'],
    recommendedPaletteId: 'forbidden_city',
    recommendedPlankStyle: 'gold_bar',
    colors: {
      clothTop: '#DC2626', // 大红战袍
      clothBottom: '#B45309', // 虎皮战裙/赭石
      accent: '#F59E0B', // 纯金锁子甲与紧箍
      specialGold: '#FDE047',
      skin: '#FCD34D', // 猴王金毛
    },
    fbxMetadata: {
      fileName: 'Character_SunWukong_LOD0.fbx',
      formatVersion: 'FBX 2020 / Mixamo Humanoid v1.4',
      rigType: 'Mixamo Standard Humanoid + Dual Plumes',
      rootBone: 'mixamorig:Hips',
      totalBones: 59,
      customBones: [
        'mixamorig:Plume_L_01',
        'mixamorig:Plume_L_02',
        'mixamorig:Plume_R_01',
        'mixamorig:Plume_R_02',
        'mixamorig:TigerSkirt_01',
        'mixamorig:TigerSkirt_02',
        'mixamorig:Cape_Rear_01',
      ],
      geometry: {
        trianglesLOD0: 3420,
        trianglesLOD1: 1840,
        vertices: 1856,
        materialSlots: [
          'Mat_Wukong_SkinGold',
          'Mat_Wukong_ArmorGold',
          'Mat_Wukong_RobeRed',
          'Mat_Wukong_CloudBoots',
        ],
      },
      animationClips: [
        {
          name: 'Sprint_Wukong_Forward',
          mixamoSource: 'Running.fbx (Modified Leap Stride)',
          duration: '0.68s',
          loop: true,
          fps: 30,
          notes: '如踏筋斗云般的腾空跃进大步频，雉翎随疾风向后大角度招展',
        },
        {
          name: 'Carry_Wood_Run',
          mixamoSource: 'Standing Carry Run Forward.fbx',
          duration: '0.72s',
          loop: true,
          fps: 30,
          notes: '双手捧握沉重桥板向前冲刺，重心前倾，肩膀微幅自然耸动',
        },
        {
          name: 'Drowning_Somersault_Splash',
          mixamoSource: 'Falling Flat Backwards.fbx',
          duration: '1.20s',
          loop: false,
          fps: 30,
          notes: '踩空失足落水触发，伴随身体腾空后仰与水花激荡粒子',
        },
        {
          name: 'Victory_Golden_Strike',
          mixamoSource: 'Cheering Victory Stance.fbx',
          duration: '1.80s',
          loop: true,
          fps: 30,
          notes: '冲过终点阶梯判定结算时触发，昂首挺胸致意',
        },
      ],
      cocosMetaConfig: {
        ver: '1.0.8',
        importer: 'fbx',
        importedWithDefaultSettings: false,
        subMetas: {
          skeleton: {
            useMixamoMapping: true,
            bindPoseNormalized: true,
            bakeInverseKinematics: true,
          },
          mesh: {
            enableLOD: true,
            lodLevels: [{ screenRatio: 0.25, reductionRate: 0.45 }],
            meshOptimizer: {
              quantizePosition: true,
              quantizeNormal: true,
              compressIndices: true,
            },
          },
          animation: {
            fps: 30,
            loopMatchTolerance: 0.05,
            resampleClips: true,
          },
        },
      },
    },
  },
  {
    id: 'nezha',
    name: '三坛海会 · 哪吒',
    englishName: 'Nezha (The Lotus Prince)',
    tag: '灵珠降世莲花身',
    avatar: '🔥',
    lore: '明代《封神演义》· 灵珠转世脱俗化莲',
    description: '头顶双冲天丸子抓髻与额间朱砂神火印，手持乾坤金圈，身系飘逸混天红绫仙帛，穿荷花金边红肚兜与碧翠荷叶短裳，灵动无双。',
    signatureArtifacts: ['双冲天丸子发髻配红丝带', '金光乾坤项圈与手镯', '双翼飞扬混天绫仙帛', '额前朱砂神火印'],
    recommendedPaletteId: 'guofeng_landscape',
    recommendedPlankStyle: 'bamboo_raft',
    colors: {
      clothTop: '#E11D48', // 烈火朱红肚兜
      clothBottom: '#059669', // 碧翠荷叶短裳
      accent: '#F59E0B', // 纯金乾坤圈
      specialGold: '#FBBF24',
      skin: '#FED7AA', // 白皙微粉玉肌
    },
    fbxMetadata: {
      fileName: 'Character_Nezha_LOD0.fbx',
      formatVersion: 'FBX 2020 / Mixamo Humanoid v1.4',
      rigType: 'Mixamo Standard Humanoid + Huntian Ribbon Chain',
      rootBone: 'mixamorig:Hips',
      totalBones: 62,
      customBones: [
        'mixamorig:Ribbon_L_01',
        'mixamorig:Ribbon_L_02',
        'mixamorig:Ribbon_L_03',
        'mixamorig:Ribbon_R_01',
        'mixamorig:Ribbon_R_02',
        'mixamorig:Ribbon_R_03',
        'mixamorig:HairBun_L',
        'mixamorig:HairBun_R',
        'mixamorig:LotusTasset_01',
        'mixamorig:LotusTasset_02',
      ],
      geometry: {
        trianglesLOD0: 2980,
        trianglesLOD1: 1620,
        vertices: 1612,
        materialSlots: [
          'Mat_Nezha_SkinJade',
          'Mat_Nezha_BellybandRed',
          'Mat_Nezha_LotusLeafGreen',
          'Mat_Nezha_QiankunGold',
          'Mat_Nezha_HuntianSilk',
        ],
      },
      animationClips: [
        {
          name: 'Sprint_Nezha_Swift',
          mixamoSource: 'Child Ninja Run.fbx',
          duration: '0.55s',
          loop: true,
          fps: 30,
          notes: '短而迅捷的灵巧快步，混天绫在身体两侧波浪式起伏翻卷',
        },
        {
          name: 'Carry_Plank_Sprint',
          mixamoSource: 'Fast Run With Tray.fbx',
          duration: '0.62s',
          loop: true,
          fps: 30,
          notes: '乾坤圈斜挎金光闪烁，双臂稳如磐石托负青竹排',
        },
        {
          name: 'Drowning_Water_Spin',
          mixamoSource: 'Spin Fall Water.fbx',
          duration: '1.10s',
          loop: false,
          fps: 30,
          notes: '失足坠湖，混天绫在水面展开如鲜红怒放莲花',
        },
        {
          name: 'Victory_Lotus_Pose',
          mixamoSource: 'Joyful Jump Pose.fbx',
          duration: '1.50s',
          loop: true,
          fps: 30,
          notes: '双臂振臂高呼，混天绫在头顶绕出同心圆护体金光',
        },
      ],
      cocosMetaConfig: {
        ver: '1.0.8',
        importer: 'fbx',
        importedWithDefaultSettings: false,
        subMetas: {
          skeleton: {
            useMixamoMapping: true,
            bindPoseNormalized: true,
            bakeInverseKinematics: true,
          },
          mesh: {
            enableLOD: true,
            lodLevels: [{ screenRatio: 0.25, reductionRate: 0.42 }],
            meshOptimizer: {
              quantizePosition: true,
              quantizeNormal: true,
              compressIndices: true,
            },
          },
          animation: {
            fps: 30,
            loopMatchTolerance: 0.04,
            resampleClips: true,
          },
        },
      },
    },
  },
  {
    id: 'guofeng_hero',
    name: '青莲剑客 · 少年侠客',
    englishName: 'Young Swordsman (Jianghu Hero)',
    tag: '快意恩仇踏歌行',
    avatar: '⚔️',
    lore: '盛唐武侠文脉 · 行侠仗义少年天骄',
    description: '头束利落高马尾发髻与赤红飘逸发带，穿月白汉服交领长衫与玄黑行脚剑裤，腰系朱红剑带，踏千层底青云布履，英姿勃发。',
    signatureArtifacts: ['高束马尾与赤红飞扬发带', '汉服右衽交领白锦长衫', '朱砂红腰封剑带', '千层底青云功夫鞋'],
    recommendedPaletteId: 'guofeng_landscape',
    recommendedPlankStyle: 'jade_slab',
    colors: {
      clothTop: '#F8FAFC', // 月白织锦
      clothBottom: '#0F172A', // 玄黑剑裤
      accent: '#DC2626', // 朱红发带与剑穗
      specialGold: '#F59E0B',
      skin: '#FDE68A', // 温润如玉
    },
    fbxMetadata: {
      fileName: 'Character_YoungSwordsman_LOD0.fbx',
      formatVersion: 'FBX 2020 / Mixamo Humanoid v1.4',
      rigType: 'Mixamo Standard Humanoid + Ponytail & Lapels',
      rootBone: 'mixamorig:Hips',
      totalBones: 57,
      customBones: [
        'mixamorig:Ponytail_01',
        'mixamorig:Ponytail_02',
        'mixamorig:HeadRibbon_01',
        'mixamorig:HeadRibbon_02',
        'mixamorig:BeltSash_01',
        'mixamorig:BeltSash_02',
      ],
      geometry: {
        trianglesLOD0: 2860,
        trianglesLOD1: 1540,
        vertices: 1520,
        materialSlots: [
          'Mat_Swordsman_Skin',
          'Mat_Swordsman_WhiteSilk',
          'Mat_Swordsman_BlackPants',
          'Mat_Swordsman_RedSash',
        ],
      },
      animationClips: [
        {
          name: 'Sprint_Swordsman_Lightfoot',
          mixamoSource: 'Sword Run Stride.fbx',
          duration: '0.64s',
          loop: true,
          fps: 30,
          notes: '如踏雪无痕般的轻功身法，高马尾与红发带在后方平稳拉成流线',
        },
        {
          name: 'Carry_Jade_Sprint',
          mixamoSource: 'Running Forward Arms Hold.fbx',
          duration: '0.68s',
          loop: true,
          fps: 30,
          notes: '双手平稳承接羊脂温玉板，步法沉稳中见飘逸',
        },
        {
          name: 'Drowning_Tumble_Fall',
          mixamoSource: 'Diving Fall To Water.fbx',
          duration: '1.15s',
          loop: false,
          fps: 30,
          notes: '踏虚坠入碧水，衣袂如水墨般散开晕染',
        },
        {
          name: 'Victory_Salute_Sheath',
          mixamoSource: 'Kung Fu Salute Victory.fbx',
          duration: '1.60s',
          loop: true,
          fps: 30,
          notes: '抱拳行江湖正义之礼，昂然傲立终点台',
        },
      ],
      cocosMetaConfig: {
        ver: '1.0.8',
        importer: 'fbx',
        importedWithDefaultSettings: false,
        subMetas: {
          skeleton: {
            useMixamoMapping: true,
            bindPoseNormalized: true,
            bakeInverseKinematics: true,
          },
          mesh: {
            enableLOD: true,
            lodLevels: [{ screenRatio: 0.25, reductionRate: 0.44 }],
            meshOptimizer: {
              quantizePosition: true,
              quantizeNormal: true,
              compressIndices: true,
            },
          },
          animation: {
            fps: 30,
            loopMatchTolerance: 0.05,
            resampleClips: true,
          },
        },
      },
    },
  },
];

export function generateMixamoFbxConfigJson(preset: ChineseAestheticPreset): string {
  const data = {
    $schema: 'https://cdn.cocos.com/schema/cocos-creator-3.8-fbx-meta.json',
    generator: 'ShortcutRun-ArtStudio-Mixamo-Pipeline-v2.4',
    timestamp: new Date().toISOString(),
    characterPreset: {
      id: preset.id,
      chineseName: preset.name,
      englishName: preset.englishName,
      lore: preset.lore,
      tag: preset.tag,
    },
    fbxSpecifications: {
      file: preset.fbxMetadata.fileName,
      formatVersion: preset.fbxMetadata.formatVersion,
      coordinateSystem: {
        upAxis: 'Y_UP',
        frontAxis: 'Z_FRONT',
        coordAxis: 'RIGHT_HANDED',
        unitScaleFactor: 1.0, // 1.0 = meters in Cocos/Unity
      },
      rig: {
        type: preset.fbxMetadata.rigType,
        rootBone: preset.fbxMetadata.rootBone,
        totalBoneCount: preset.fbxMetadata.totalBones,
        standardMixamoBonesCount: 52,
        customExtensionBones: preset.fbxMetadata.customBones,
      },
      geometry: {
        trianglesLOD0: preset.fbxMetadata.geometry.trianglesLOD0,
        trianglesLOD1: preset.fbxMetadata.geometry.trianglesLOD1,
        verticesCount: preset.fbxMetadata.geometry.vertices,
        weChatMiniGameBudgetStatus: 'PASS (< 4000 tris limit)',
        materialSlots: preset.fbxMetadata.geometry.materialSlots,
      },
      animations: preset.fbxMetadata.animationClips,
    },
    cocosCreatorMeta: preset.fbxMetadata.cocosMetaConfig,
  };

  return JSON.stringify(data, null, 2);
}
