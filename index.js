#!/usr/bin/env node

// sftp-upload upload files to an SFTP server.
// Copyright (C) 2020  Matthew Glazar
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

"use strict";

let SSH2SFTPClient = require("ssh2-sftp-client");
let actionsCore = require("@actions/core");
let assert = require("assert");
let fs = require("fs");
let glob = require("@actions/glob");
let path = require("path");

async function mainAsync() {
  await uploadGlobsAsync({
    host: getRequiredInput("host"),
    localFileGlobs: getRequiredInput("local-file-globs").split("\n"),
    privateKey: getRequiredInput("private-key"),
    remoteDirectory: getRequiredInput("remote-directory"),
    user: getRequiredInput("user"),
  });
}

async function uploadGlobsAsync({ localFileGlobs, ...otherOptions }) {
  let localFilesByGlob = await Promise.all(
    localFileGlobs.map(async (pattern) => await globAsync(pattern))
  );
  let haveNonMatchingLocalFileGlobs = false;
  for (let [patternIndex, files] of localFilesByGlob.entries()) {
    if (files.length === 0) {
      console.error(
        `error: Pattern matched no files: ${localFileGlobs[patternIndex]}`
      );
      haveNonMatchingLocalFileGlobs = true;
    }
  }
  if (haveNonMatchingLocalFileGlobs) {
    process.exit(1);
  }

  let localFiles = removeDuplicates(localFilesByGlob.flat());
  console.log(`note: Found ${localFiles.length} files to upload`);
  await uploadFilesAsync({
    localFiles: localFiles,
    ...otherOptions,
  });
}

async function uploadFilesAsync({
  host,
  localFiles,
  privateKey,
  remoteDirectory,
  user,
}) {
  let client = new SSH2SFTPClient();
  try {
    await client.connect({
      host: host,
      username: user,
      privateKey: privateKey,
    });
    console.log(`note: Uploading to remote directory: ${remoteDirectory}`);
    await createDirectoryRecursiveIfNotExistsAsync(client, remoteDirectory);
    for (let localFile of localFiles) {
      console.log(`note: Uploading: ${localFile}`);
      await client.put(
        localFile,
        path.join(remoteDirectory, path.basename(localFile)),
        { mode: 0o644 }
      );
    }
  } finally {
    await client.end();
  }
}

async function createDirectoryRecursiveIfNotExistsAsync(sftpClient, path) {
  try {
    await sftpClient.mkdir(path, /*recursive=*/ true);
  } catch (mkdirError) {
    try {
      let stat = await sftpClient.stat(path);
      if (stat.isDirectory) {
        // mkdir failed because the directory already exists. Ignore.
      } else {
        // mkdir failed because the path refers to a non-directory.
        throw mkdirError;
      }
    } catch (statError) {
      // mkdir failed and the path does not exist.
      throw mkdirError;
    }
  }
}

function getRequiredInput(name) {
  let value = actionsCore.getInput(name);
  if (value === "") {
    throw new Error(`Missing required input: ${name}`);
  }
  return value;
}

async function globAsync(pattern) {
  assert.strictEqual(
    /\n/.test(pattern),
    false,
    `Pattern should not contain a newline character, but it does: ${pattern}`
  );
  return await (await glob.create(pattern)).glob();
}

function removeDuplicates(items) {
  return [...new Set(items)];
}

mainAsync()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`error: ${error.stack}`);
    process.exit(1);
  });
