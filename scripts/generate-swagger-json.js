const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// swagger.yaml 파일 읽기
const swaggerYamlPath = path.join(process.cwd(), 'swagger.yaml');
const swaggerYaml = fs.readFileSync(swaggerYamlPath, 'utf8');

// YAML을 JSON으로 변환
const swaggerJson = yaml.load(swaggerYaml);

// public 폴더에 swagger.json 저장
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const swaggerJsonPath = path.join(publicDir, 'swagger.json');
fs.writeFileSync(swaggerJsonPath, JSON.stringify(swaggerJson, null, 2), 'utf8');

console.log('✅ swagger.json 파일이 생성되었습니다:', swaggerJsonPath);

