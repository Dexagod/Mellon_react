import * as React from "react";
import solid from 'solid-auth-client'
import ContactSelector from "./ContactSelector"
import CommunicationManager from '../util/CommunicationManager';
import NotificationHandler from "../util/NotificationHandler";
import MetadataFileGenerator from "../util/MetadataFileGenerator"
import { MODES, createPermission } from '../util/PermissionManager'

export class UploadFileComponent extends React.Component
{
  constructor(props) {
    super(props);

    this.cm = props.cm || new CommunicationManager(solid)
    this.nh = props.nh || new NotificationHandler(this.cm, solid)

    this.handleChange = this.handleChange.bind(this);
    this.uploadFile = this.uploadFile.bind(this)
    this.uploadFile = this.uploadFile.bind(this)
    this.submit = this.submit.bind(this)
    this.getNewState = this.getNewState.bind(this);
    this.getStorageLocationForFile = this.getStorageLocationForFile.bind(this)

    this.state = {file: null, uploading: false, storageLocation: ""}
  }

  componentDidMount() {
    const { me } = this.props;
    if (me && me.id && me.id.length) {
      this.setState({ storageLocation: this.cm.getBaseIRI(me.id) + "papers/"})
    }
  }

  componentDidUpdate(prevProps) {
    const { me } = this.props;
    if (me.id !== prevProps.me.id) {
      this.setState({ storageLocation: this.cm.getBaseIRI(me.id) + "papers/"})
    }
  }

  // This only gets called after a paper was submitted. storagelocation should not be reset.
  getNewState(){
    return {file: null, uploading: false, storageLocation: this.state.storageLocation || ""}
  }

  handleChange(selectedFiles) {
    this.setState({file: selectedFiles[0]})
  }

  handleStorageLocation(location) {
    this.setState({storageLocation: location})
  }

  async uploadFile(){
    this.setState({uploading: true})
  }


  getStorageLocationForFile(file) {
    let storageLocation = this.state.storageLocation;
    if (!storageLocation) return;
    if (!storageLocation.endsWith("/")) storageLocation = storageLocation + "/";
    return storageLocation + file.name;
  }

  async submit(contacts) {
    console.log("Submitting", this.state.file, contacts)
    const webId = this.props.me.id;
    const file = this.state.file;
    const fileId = this.getStorageLocationForFile(this.state.file);
    const contactIds = contacts.map(c => c.id);
    console.log("fileId", fileId)
    if(!webId || !fileId || !this.cm || !this.nh) {
      console.error("fileupload component not initialized correctly")
      console.log(!webId, !file, !fileId, !this.cm, !this.nh)
      return;
    }

    // Todo: allow to choose a title
    const paperMetadata = {
      id: fileId,
      title: file.name.split(".")[0],
      metadatalocation: "",
      publisher: webId
    };

    const response = await this.cm.addPaper(file, paperMetadata);
    console.log("added paper", response.url, file.name);
    const paperURI = response.url;
    paperMetadata["id"] = paperURI;
    console.log(paperURI, "added succesfully");

    let inboxes = [];
    for (let contact of contactIds) {
      if (contact && validURL(contact)) {
        try {
          inboxes.push(
            (await this.nh.discoverInboxUri(contact)) || contact
          );
        } catch (e) {
          console.log(e);
        }
      }
    }

    for (let inbox of inboxes) {
      const notification = await MetadataFileGenerator.createPaperPublishedNotification(
        webId,
        paperURI,
        paperMetadata.title
      );
      const result = await this.nh.send(inbox, notification);
      console.log("inbox", inbox, "notified with result", result);
    }

    // TODO: move to CommunicationManager?
    // Notified people can read the paper
    console.log("Setting READ for all selected contactIds");
    this.cm.pm.createACL(paperURI,
      contactIds.length ? [createPermission([MODES.READ], contactIds)] : []
    );
    this.cm.pm.createACL(this.cm.getMetadataURI(paperURI),
    contactIds.length ? [createPermission([MODES.READ], contactIds)] : []
    );
    // All readers of the paper should also be able to read the parent folder
    if (contactIds.length) {
      let folderName = paperURI.split('/').slice(0, -1).join('/') + '/'
      this.cm.pm.addToACL(folderName, [createPermission([MODES.READ], contactIds)])
    }

    // create notification
    // this.props.paperAdded && this.props.paperAdded(paperMetadata);
    // reset component
    this.setState(this.getNewState());
    // Notify that a file has been uploaded
    this.props.navigateToFile(paperURI);
  }

  render () {
    if (this.state.uploading) {
      return (
        <div>
          <ContactSelector contacts={this.props.contacts} submit={this.submit}/>
        </div>
      )
    }
    return (
      <div>
        <input type="file" onChange={ (e) => this.handleChange(e.target.files) } />
        <p>storage location</p>
        <input value={this.state.storageLocation} onChange={ (e) => this.handleStorageLocation(e.target.value) } />
        <button onClick={() => {this.uploadFile()}}>Upload</button>
      </div>
    )
  }
}

//https://www.webmasterworld.com/devshed/javascript-development-115/regexp-to-match-url-pattern-493764.html
export function validURL(str) {
  const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(str);
}