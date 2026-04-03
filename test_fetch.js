const { execSync } = require('child_process');
async function run() {
    const res = await fetch("https://formulae.brew.sh/api/formula/libomp.json");
    const json = await res.json();
    console.log(json.bottle.stable.files['arm64_sequoia'].url);
}
run();
