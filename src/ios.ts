import fs from 'fs/promises';
import path from 'path';
import plistParser from 'plist';

export type Project = any;

export type Group = any;

const getFirstProject = (project: Project) => project.getFirstProject().firstProject;

const findGroup = (group: Group, name: string) => group.children.find((it: any) => it.comment === name);

const getGroup = (project: Project, path?: string) => {
  const firstProject = getFirstProject(project);

  let group = project.getPBXGroupByKey(firstProject.mainGroup);

  if (!path) {
    return group;
  }

  for (const name of path.split('/')) {
    const found = findGroup(group, name);

    if (found) {
      group = project.getPBXGroupByKey(found.value);
    } else {
      group = null;
      break;
    }
  }

  return group;
}

const createGroup = (project: Project, path: string) => {
  return path.split('/').reduce((group, name) => {
    const found = findGroup(group, name);

    if (!found) {
      const uuid = project.pbxCreateGroup(name, '""');

      group.children.push({
        value: uuid,
        comment: name
      });
    }

    return project.pbxGroupByName(name);
    },
    getGroup(project)
  );
}

export const getOrCreateGroup = (project: Project, path: string) => {
  let group = getGroup(project, path);

  if (!group) {
    group = createGroup(project, path);
  }

  return group;
}

const getBuildProperty = (project: Project, name: string) => {
  const { firstTarget } = project.getFirstTarget();
  const config = project.pbxXCConfigurationList()[firstTarget.buildConfigurationList];
  const { buildSettings } = project.pbxXCBuildConfigurationSection()[config.buildConfigurations[0].value];
  return buildSettings[name];
}

const getPlistPath = (project: Project, dest: string) => {
  const plistFile = getBuildProperty(project, 'INFOPLIST_FILE');
  if (!plistFile) {
    return null;
  }

  return path.join(
    dest,
    plistFile.replace(/"/g, '').replace('$(SRCROOT)', ''),
  );
}

export const getPlist = async (project: Project, dest: string) => {
  const plistPath = getPlistPath(project, dest);
  if (!plistPath) {
    return null;
  }

  return plistParser.parse(await fs.readFile(plistPath, 'utf8'));
}

export const writePlist = async (project: Project, dest: string, plist: any) => {
  const plistPath = getPlistPath(project, dest);
  if (!plistPath) {
    throw new Error('plist not found');
  }

  await fs.writeFile(plistPath, `${plistParser.build(plist, { indent: '\t', offset: -1 })}\n`);
}
