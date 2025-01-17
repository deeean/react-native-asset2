#! /usr/bin/env bun

// @ts-ignore
import xcode from "xcode";
import fs from 'fs/promises';
import { Presets, SingleBar } from 'cli-progress';
import { getOrCreateGroup, getPlist, writePlist } from "./ios.ts";
import { readAssets } from "./utils.ts";

const assets = await readAssets('./assets');

const assetsSet = new Set(assets.map((it) => it.basename));

const fontsExtensions = new Set(['.ttf', '.otf']);

const fontAssets = assets.filter((it) => fontsExtensions.has(it.extname));

const entries = await fs.readdir('./ios');
const xcodeproj = entries.find((it) => it.endsWith('.xcodeproj'));
if (!xcodeproj) {
  throw new Error('xcodeproj not found');
}

const project = xcode.project(`./ios/${xcodeproj}/project.pbxproj`).parseSync();

const plist: any = await getPlist(project, './ios');
if (!plist) {
  throw new Error('plist not found');
}

plist.UIAppFonts = fontAssets.map((it) => it.basename);

const group = getOrCreateGroup(project, 'Resources');

const existsAssets = new Set<string>(group.children.map((it: any) => it.comment));

const uuid = project.getFirstTarget().uuid;

const notExistsAssets = Array.from(existsAssets).filter((it) => {
  return !assetsSet.has(it);
});

const progressBar = new SingleBar({}, Presets.shades_classic);

progressBar.start(notExistsAssets.length + assets.length, 0);

for (let i = 0, length = notExistsAssets.length; i < length; i++) {
  const notExistsAsset = notExistsAssets[i];

  project.removeResourceFile(
    notExistsAsset,
    {
      target: uuid
    }
  );

  progressBar.update(i + 1);
}

for (let i = 0, length = assets.length; i < length; i++) {
  const asset = assets[i];

  if (!existsAssets.has(asset.basename)) {
    project.addResourceFile(
      asset.path,
      {
        target: uuid
      }
    )
  }

  progressBar.update(notExistsAssets.length + i + 1);
}

progressBar.stop();

await writePlist(project, './ios', plist);
await fs.writeFile(`./ios/${xcodeproj}/project.pbxproj`, project.writeSync());
