#! /usr/bin/env bun

// @ts-ignore
import xcode from "xcode";
import fs from 'fs/promises';
import { Presets, SingleBar } from 'cli-progress';
import { getOrCreateGroup, getPlist, writePlist } from "./ios.ts";
import { exists, readAssets } from "./utils.ts";
import { ThreadPool } from "./threadpool.ts";
import path from "path";

const assets = await readAssets('./assets');

const assetsSet = new Set(assets.map((it) => it.basename));

const fontsExtensions = new Set(['.ttf', '.otf']);

const imagesExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif']);

const rawExtensions = new Set(['.mp3']);

const fontAssets = [];
const imageAssets = [];
const rawAssets = [];
const customAssets = [];

for (let i = 0, length = assets.length; i < length; i++) {
  const asset = assets[i];
  if (fontsExtensions.has(asset.extname)) {
    fontAssets.push(asset);
  } else if (imagesExtensions.has(asset.extname)) {
    imageAssets.push(asset);
  } else if (rawExtensions.has(asset.extname)) {
    rawAssets.push(asset);
  } else {
    customAssets.push(asset);
  }
}


{
  const progressBar = new SingleBar({}, Presets.shades_classic);

  const destinations = [
      ...fontAssets.map(it => [it.path, `./android/app/src/main/assets/fonts/${it.basename}`]),
      ...imageAssets.map(it => [it.path, `./android/app/src/main/res/drawable/${it.basename}`]),
      ...rawAssets.map(it => [it.path, `./android/app/src/main/res/raw/${it.basename}`]),
      ...customAssets.map(it => [it.path, `./android/app/src/main/assets/custom/${it.basename}`]),
  ];

  progressBar.start(destinations.length, 0);

  const pool = new ThreadPool(10);

  for (const [filePath, dest] of destinations) {
    pool.execute(async () => {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(filePath, dest);

      progressBar.increment();
    });
  }

  await pool.wait();

  progressBar.stop();
}

{

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
}
