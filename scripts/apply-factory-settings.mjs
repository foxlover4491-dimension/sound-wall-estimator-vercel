#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const APP_ID = 'sound-wall-estimator';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const indexPath = path.join(repoRoot, 'index.html');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const stdinMode = args.includes('--stdin');
const inputFile = args.find((arg)=>!arg.startsWith('--'));

function usage(){
  return [
    'Usage:',
    '  node scripts/apply-factory-settings.mjs <factory-settings.json>',
    '  node scripts/apply-factory-settings.mjs --stdin < factory-settings.json',
    '  node scripts/apply-factory-settings.mjs',
    '',
    'No file means the script tries to read the macOS clipboard.'
  ].join('\n');
}

async function readStream(stream){
  let out = '';
  stream.setEncoding('utf8');
  for await (const chunk of stream) out += chunk;
  return out;
}

async function readInput(){
  if(inputFile) return readFile(path.resolve(process.cwd(), inputFile), 'utf8');
  if(stdinMode) return readStream(process.stdin);
  try{
    return execFileSync('pbpaste', {encoding:'utf8'});
  } catch(err){
    throw new Error(`${usage()}\n\n입력 파일을 찾지 못했고 클립보드도 읽지 못했습니다.`);
  }
}

function tryParseJson(text){
  try{
    return JSON.parse(text);
  } catch(err){
    return null;
  }
}

function extractBalancedJson(text){
  const direct = tryParseJson(text.trim());
  if(direct) return direct;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fence){
    const fenced = tryParseJson(fence[1].trim());
    if(fenced) return fenced;
  }

  const firstBrace = text.indexOf('{');
  if(firstBrace < 0) throw new Error('JSON 시작 부분을 찾지 못했습니다.');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for(let i=firstBrace; i<text.length; i++){
    const ch = text[i];
    if(inString){
      if(escaped){
        escaped = false;
      } else if(ch === '\\'){
        escaped = true;
      } else if(ch === '"'){
        inString = false;
      }
      continue;
    }
    if(ch === '"'){
      inString = true;
      continue;
    }
    if(ch === '{') depth++;
    if(ch === '}') depth--;
    if(depth === 0){
      const candidate = text.slice(firstBrace, i + 1);
      const parsed = tryParseJson(candidate);
      if(parsed) return parsed;
    }
  }

  throw new Error('완성된 JSON 객체를 찾지 못했습니다.');
}

function requireObject(value, label){
  if(!value || typeof value !== 'object' || Array.isArray(value)){
    throw new Error(`${label} 값이 없습니다.`);
  }
  return value;
}

function requireArray(value, label){
  if(!Array.isArray(value)){
    throw new Error(`${label} 값이 없습니다.`);
  }
  return value;
}

function toJs(value){
  return JSON.stringify(value, null, 2);
}

function replaceAssigned(source, prefix, suffix, nextValue, label){
  const start = source.indexOf(prefix);
  if(start < 0) throw new Error(`${label} 시작 위치를 찾지 못했습니다.`);
  const valueStart = start + prefix.length;
  const end = source.indexOf(suffix, valueStart);
  if(end < 0) throw new Error(`${label} 끝 위치를 찾지 못했습니다.`);
  return `${source.slice(0, valueStart)}${toJs(nextValue)}${source.slice(end)}`;
}

function buildPatch(source, payload){
  if(payload.app && payload.app !== APP_ID){
    throw new Error(`앱 ID가 다릅니다: ${payload.app}`);
  }

  const materialConfig = requireObject(payload.materialConfig, 'materialConfig');
  const presetGroups = requireArray(payload.presetGroups, 'presetGroups');
  const planLayerConfig = requireObject(payload.planLayerConfig, 'planLayerConfig');

  requireObject(materialConfig.MAT, 'materialConfig.MAT');
  requireObject(materialConfig.SUPPLIERS, 'materialConfig.SUPPLIERS');
  requireArray(materialConfig.wallItems, 'materialConfig.wallItems');
  requireArray(materialConfig.ceilItems, 'materialConfig.ceilItems');
  requireArray(materialConfig.floorItems, 'materialConfig.floorItems');
  const materialOrder = Array.isArray(materialConfig.order) ? materialConfig.order : Object.keys(materialConfig.MAT);
  requireObject(materialConfig.defaults, 'materialConfig.defaults');
  requireArray(materialConfig.defaults.wall, 'materialConfig.defaults.wall');
  requireArray(materialConfig.defaults.ceil, 'materialConfig.defaults.ceil');
  requireArray(materialConfig.defaults.floor, 'materialConfig.defaults.floor');
  requireArray(planLayerConfig.ceil, 'planLayerConfig.ceil');
  requireArray(planLayerConfig.floor, 'planLayerConfig.floor');

  let next = source;
  next = replaceAssigned(next, 'let MAT = ', ';\nconst MERGE_GROUPS', materialConfig.MAT, 'MAT');
  next = replaceAssigned(next, 'let SUPPLIERS = ', ';\nconst COMPOSITES', materialConfig.SUPPLIERS, 'SUPPLIERS');
  next = replaceAssigned(next, 'let WALL_ITEMS = ', ';\nlet CEIL_ITEMS', materialConfig.wallItems, 'WALL_ITEMS');
  next = replaceAssigned(next, 'let CEIL_ITEMS = ', ';\nlet FLOOR_ITEMS', materialConfig.ceilItems, 'CEIL_ITEMS');
  next = replaceAssigned(next, 'let FLOOR_ITEMS = ', ';\nlet WALL_DEFAULT', materialConfig.floorItems, 'FLOOR_ITEMS');
  next = replaceAssigned(next, 'let WALL_DEFAULT = ', ';\nlet CEIL_DEFAULT', materialConfig.defaults.wall, 'WALL_DEFAULT');
  next = replaceAssigned(next, 'let CEIL_DEFAULT = ', ';\nlet FLOOR_DEFAULT', materialConfig.defaults.ceil, 'CEIL_DEFAULT');
  next = replaceAssigned(next, 'let FLOOR_DEFAULT = ', ';\nlet MATERIAL_ORDER', materialConfig.defaults.floor, 'FLOOR_DEFAULT');
  next = replaceAssigned(next, 'let MATERIAL_ORDER = ', ';\nconst BASE_MAT', materialOrder, 'MATERIAL_ORDER');
  next = replaceAssigned(next, 'let PRESET_GROUPS = ', ';\nconst METRIC_LABELS', presetGroups, 'PRESET_GROUPS');
  next = replaceAssigned(next, 'const BASE_PLAN_LAYER_PRESETS = ', ';\nfunction allPresets', planLayerConfig, 'BASE_PLAN_LAYER_PRESETS');
  return next;
}

const raw = await readInput();
if(!raw.trim()) throw new Error(`${usage()}\n\n입력 내용이 비어 있습니다.`);

const payload = extractBalancedJson(raw);
const current = await readFile(indexPath, 'utf8');
const next = buildPatch(current, payload);

if(next === current){
  console.log('변경할 내용이 없습니다.');
  process.exit(0);
}

if(dryRun){
  console.log('검사 완료: index.html 기본값 블록을 갱신할 수 있습니다.');
} else {
  await writeFile(indexPath, next, 'utf8');
  console.log('완료: index.html 기본값 블록을 갱신했습니다.');
}
