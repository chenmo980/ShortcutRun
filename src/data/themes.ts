import { ColorPalette } from '../types';

export const THEME_PALETTES: ColorPalette[] = [
  {
    id: 'voodoo_pastel',
    name: 'VOODOO 经典马卡龙',
    description: '经典的超休闲高饱和糖果配色，明亮清新、视觉对比鲜明，吸睛度极高',
    waterDeep: '#1098F7',
    waterShallow: '#48CAE4',
    waterFoam: '#E0FBFC',
    trackColor: '#FFFFFF',
    trackBorder: '#E2E8F0',
    plankColor: '#FFB703',
    playerColor: '#FF006E',
    accentColor: '#3A86FF',
    finishColor: '#8338EC',
    skyTop: '#BEE1E6',
    skyBottom: '#F0EFEB',
  },
  {
    id: 'tropical_ocean',
    name: '热带海岛微风',
    description: '翡翠绿渐变海水与暖木纹栈道，营造轻快惬意的海岛度假赛道体验',
    waterDeep: '#0077B6',
    waterShallow: '#00B4D8',
    waterFoam: '#90E0EF',
    trackColor: '#E9D8A6',
    trackBorder: '#D4A373',
    plankColor: '#EE9B00',
    playerColor: '#005F73',
    accentColor: '#94D2BD',
    finishColor: '#AE2012',
    skyTop: '#C8E7F5',
    skyBottom: '#FAF0CA',
  },
  {
    id: 'sunset_boulevard',
    name: '落日金辉余晖',
    description: '暖橙金黄与紫霞相映，极具情绪感染力的黄昏海面，光影质感出众',
    waterDeep: '#581845',
    waterShallow: '#900C3F',
    waterFoam: '#FFC300',
    trackColor: '#F7D070',
    trackBorder: '#E36414',
    plankColor: '#FB5607',
    playerColor: '#FFBE0B',
    accentColor: '#FF006E',
    finishColor: '#3A0CA3',
    skyTop: '#8338EC',
    skyBottom: '#FB5607',
  },
  {
    id: 'cyberpunk_neon',
    name: '赛博霓虹夜跑',
    description: '深黑电竞底色搭配发光青蓝与品红能量砖，现代炫酷科技感',
    waterDeep: '#050517',
    waterShallow: '#101735',
    waterFoam: '#00F0FF',
    trackColor: '#1A1E29',
    trackBorder: '#7000FF',
    plankColor: '#00F5D4',
    playerColor: '#FF007F',
    accentColor: '#FEE440',
    finishColor: '#9B5DE5',
    skyTop: '#0D0826',
    skyBottom: '#1F1147',
  },
  {
    id: 'graybox_prototype',
    name: '原版灰模 (对比用)',
    description: '未经调色与渲染包装的纯灰模形态，可点击实时对比美工调色前后的巨大差别',
    waterDeep: '#3F444E',
    waterShallow: '#5A6270',
    waterFoam: '#8892B0',
    trackColor: '#C4CAD0',
    trackBorder: '#8A929E',
    plankColor: '#9FA6B2',
    playerColor: '#D1D5DB',
    accentColor: '#6B7280',
    finishColor: '#4B5563',
    skyTop: '#71717A',
    skyBottom: '#9CA3AF',
    isGraybox: true,
  },
];

export const COCOS_WATER_SHADER_CODE = `// Cocos Creator 3.8.x - Stylized Water Effect (water-toon.effect)
// 适用于微信小游戏高性能卡通水体，带正弦波顶点位移与浅滩边缘泡沫
CCEffect %{
  techniques:
  - name: opaque
    passes:
    - vert: water-vs:vert
      frag: water-fs:frag
      properties: &props
        mainColor:      { value: [0.1, 0.6, 0.95, 1.0], editor: { type: color } }
        shallowColor:   { value: [0.3, 0.8, 1.0, 1.0], editor: { type: color } }
        foamColor:      { value: [0.9, 0.98, 1.0, 1.0], editor: { type: color } }
        waveSpeed:      { value: 1.5, editor: { range: [0.1, 5.0, 0.1] } }
        waveHeight:     { value: 0.12, editor: { range: [0.0, 1.0, 0.02] } }
        waveFrequency:  { value: 0.8, editor: { range: [0.1, 3.0, 0.1] } }
        foamThreshold:  { value: 0.08, editor: { range: [0.0, 0.3, 0.01] } }
}%

CCProgram water-vs %{
  precision highp float;
  #include <legacy/input-standard>
  #include <builtin/uniforms/cc-global>
  #include <legacy/local-batch>

  out vec3 v_worldPos;
  out vec3 v_normal;
  out vec2 v_uv;

  uniform Constants {
    vec4 mainColor;
    vec4 shallowColor;
    vec4 foamColor;
    float waveSpeed;
    float waveHeight;
    float waveFrequency;
    float foamThreshold;
  };

  vec4 vert () {
    StandardVertInput In;
    CCVertInput(In);

    mat4 matWorld, matWorldIT;
    CCGetWorldMatrixFull(matWorld, matWorldIT);

    vec4 wPos = matWorld * In.position;

    // Gerstner / Sine wave displacement
    float wave = sin(wPos.x * waveFrequency + cc_time.x * waveSpeed) *
                 cos(wPos.z * waveFrequency * 0.8 + cc_time.x * waveSpeed * 0.7);
    wPos.y += wave * waveHeight;

    v_worldPos = wPos.xyz;
    v_normal = normalize((matWorldIT * vec4(In.normal, 0.0)).xyz);
    v_uv = In.uv;

    return cc_matProj * cc_matView * wPos;
  }
}%

CCProgram water-fs %{
  precision highp float;
  #include <builtin/uniforms/cc-global>

  in vec3 v_worldPos;
  in vec3 v_normal;
  in vec2 v_uv;

  uniform Constants {
    vec4 mainColor;
    vec4 shallowColor;
    vec4 foamColor;
    float waveSpeed;
    float waveHeight;
    float waveFrequency;
    float foamThreshold;
  };

  vec4 frag () {
    // 简易波纹条纹与微光模拟
    float ripple = sin((v_worldPos.x + v_worldPos.z) * 3.0 + cc_time.x * waveSpeed * 2.0);
    vec4 col = mix(mainColor, shallowColor, clamp(v_worldPos.y / waveHeight * 0.5 + 0.5, 0.0, 1.0));

    if (ripple > 0.85) {
      col = mix(col, foamColor, (ripple - 0.85) * 6.0);
    }
    return col;
  }
}%`;

export const MIXAMO_GUIDE = [
  {
    action: '常规跑步 (Running)',
    mixamoName: 'Running / Standard Run',
    notes: '主角空手或少量木板时的奔跑循环，步频需与移动速度匹配 (默认 12m/s 调至 1.2x 速度)',
  },
  {
    action: '负重冲刺 (Carrying Run)',
    mixamoName: 'Heavy Run / Running While Holding',
    notes: '当吃砖数量 > 10 块时，切换至此动作，双手抱持于胸前，增加速度感与重物惯性',
  },
  {
    action: '落水挣扎 (Drowning/Falling)',
    mixamoName: 'Falling Flat / Drowning Flail',
    notes: '木板耗尽踩空落水瞬间触发，禁用控制，伴随水花粒子与镜头轻微震屏',
  },
  {
    action: '胜利庆祝 (Victory Dance)',
    mixamoName: 'Twist Dance / Cheer / Winner Stance',
    notes: '冲过终点阶梯判定结算时触发，视角自动旋转并爆发彩带粒子',
  },
];

export const AI_PROMPTS = [
  {
    tool: 'Meshy.ai / Tripo3D (3D 角色低模生成)',
    prompt:
      'Low poly stylized 3D stickman runner character, cute proportions, flat pastel shading, T-pose, mobile game ready, clean topology, under 2000 polygons, no textures, smooth surface',
  },
  {
    tool: 'Midjourney / Imagen (微信小游戏封面与 ICON)',
    prompt:
      'Mobile game app icon, cute 3D low poly runner carrying a giant stack of golden planks over vibrant turquoise ocean, sunny day, casual game style like VOODOO Shortcut Run, clean minimal background, sharp focus, 3D render, blender style, soft lighting',
  },
  {
    tool: 'Midjourney (游戏结算与商城 UI)',
    prompt:
      'Casual mobile game UI victory screen kit, glossy rounded buttons, clean vector star badges, coin icon, vibrant yellow and purple accents, white background, modern flat design, cute game interface assets',
  },
];
