// eslint-disable-next-line @typescript-eslint/no-var-requires
const FileClient = require("solid-file-client");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const irc = require('@inrupt/solid-react-components');

const ORIGIN = "http://localhost:8080";
const DEFAULT_ACCEPT = "application/ld+json;q=0.9,text/turtle;q=0.8";

async function catchError(operation: any) {
  return await operation()
    .catch((err: any) => {
      if (err.status === 403 && err.statusText === "Origin Unauthorized") {
        alert(`Please give ${ORIGIN} full access to the solid pod.`)
      }
    })
}

export class FileUtil {
  fc: any;
  auth: any;
  constructor(auth: any) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.fc = new FileClient(auth);
    this.auth = auth;
  }

  async getFile(fileURL: string) {
    const data = await this.auth.fetch(fileURL, {
      method: "GET",
      headers: {
        Accept: DEFAULT_ACCEPT,
        Origin: ORIGIN
      }
    });
    return await data.text();
  }

  async patchFile(fileURL: string, content: string) {
    return await this.auth.fetch(fileURL, {
      method: "PATCH",
      headers: {
        Origin: ORIGIN,
        "Content-Type": "application/sparql-update"
      },
      body: content
    });
  }

  // Post file from string
  async postFile(fileURL: string, content: string, contentType: string) {
    const session = await this.auth.currentSession()
    if(!session) {throw new Error("no session")}
    const webId = session.webId;
    if(!webId) {throw new Error("no webId")}
    return await this.fc.postFile(fileURL, content, contentType);
  }

  async createDirectory(directoryURL: string) {
    return await catchError(() => this.fc.createFolder(directoryURL));
  }

  // Post file from file
  async uploadFile(file: File, remoteFilePath: string) {
    return await this.fc.putFile(remoteFilePath, file, file.type);
  }

  async fileExists(fileURL: string) {
    return this.fc.itemExists(fileURL);
  }
}
