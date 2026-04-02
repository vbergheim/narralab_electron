import { downloadHomebrewBottle, extractArchive, resolveBottleCellarVersion } from './electron/main/transcription-engine-install';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

async function run() {
    try {
        const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'omp-'));
        const pTar = path.join(stage, 'omp.tar.gz');
        await downloadHomebrewBottle('libomp', 'arm64_sonoma', pTar, () => {});
        const pDir = path.join(stage, 'd');
        await extractArchive(pTar, pDir);
        const pVers = resolveBottleCellarVersion(path.join(pDir, 'libomp'), 'lib/libomp.dylib');
        await fs.copyFile(path.join(pVers, 'lib', 'libomp.dylib'), '/Users/vegard/Library/Application Support/narralab/whisper/engine/lib/libomp.dylib');
        console.log("Copied libomp.dylib!");
    } catch(e) { console.error(e) }
}
run();
