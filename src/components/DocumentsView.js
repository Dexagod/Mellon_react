// Import React as usual
import React from 'react';
import FadeLoader from 'react-spinners/FadeLoader'

// Import Chonky
import 'chonky/style/main.css';
import {FileBrowser, FileView} from 'chonky';

import solid from 'solid-auth-client'
import CommunicationManager from '../util/CommunicationManager';
import InitializePaperCollectionComponent from "./InitializePaperCollectionComponent"

import "./DocumentsView.css"


export default class DocumentsView extends React.Component {
    constructor(props) {
        super(props);

        this.cm = props.cm || new CommunicationManager(solid);
        this.fileData = new Map()
        this.webId = ""
        this.state = {
            searchId: "",
            files: [],
            collection: false,
            loading: true
        };

        this.chonkyRef = React.createRef();
        this.handleSelectionChange = this.handleSelectionChange.bind(this)
        this.changeSearchId = this.changeSearchId.bind(this)
        this.updateSearchId = this.updateSearchId.bind(this)
        this.initializedCollection = this.initializedCollection.bind(this)
        this.onFileOpen = this.onFileOpen.bind(this)
    }

    componentDidMount(){
      this.asyncInit();
    }

    componentDidUpdate(prevProps) {
      if (prevProps.selectFile !== this.props.selectFile) {
        // Update files first because this probably get's called when new file uploaded
        this.setState({ loading: true }, () => this.updateSearchId(() => this.selectFile(this.props.selectFile)));
      }
    }

    async asyncInit() {
      const webId = await this.cm.getCurrentWebID()
      if(!webId) { this.setState({ loading: false }); return; }
      // If there is one or more collections
      const collection = (await this.cm.getPaperCollections(webId)).length;

      this.setState({searchId: webId, collection: collection }, () => {
        this.asyncUpdate(this.state.searchId)
      });
    }

    async asyncUpdate(searchId, afterUpdateCallback = () => {}){
      console.log("getting", this.state, this.state.webId)
      if(!this.state.collection) { this.setState({ loading: false }); return; }
      const webId = searchId
      const fileData = new Map();
      let documents = await this.cm.getResearchPapers(webId);
      if(!documents || documents.length === 0) {
        this.setState({ files: [], loading: false })
        return;
      }
      for (let document of documents) {
        fileData.set(document.id, document)
        document.name = document.id.split("/").slice(document.id.split("/").length-1)[0]
        document.ext = document.id.split(".")[document.id.split(".").length-1]
      }
      console.log(documents)
      this.fileData = fileData;
      this.setState({ files: documents, loading: false }, afterUpdateCallback);
    }

    selectFile(fileURI) {
      let selection = {};
      for (let file of this.state.files) {
        if (file.id === fileURI) {
          selection[fileURI] = true;
          this.chonkyRef.current.setSelection(selection);
          return;
        }
      }
    }

    handleSelectionChange = (selection) => {
      // Workaround because the component allows for more that 1 file to be` selected at a time
      if(Object.keys(selection).length > 1) {
        let keys = Object.keys(selection)
        for (let key of keys.slice(1)){
          delete selection[key]
        }
        this.chonkyRef.current.setSelection(selection)
        return
      }
      const documentSelection = {}
      for (let documentId of Object.keys(selection)){
        documentSelection[documentId] = this.fileData.get(documentId)
      }
      this.props.handleSelection(documentSelection)
    };

    onFileOpen = ({ id }) => {
      window.open(id, '_blank');
    }

    changeSearchId(e){
      console.log("updating search id", e.target.value)
      this.setState({searchId: e.target.value})
    }

    updateSearchId(afterUpdateCallback = () => {}){
      this.setState({ loading: true }, () => this.asyncUpdate(this.state.searchId, afterUpdateCallback));
    }

    initializedCollection() {
      this.setState({ loading: true }, () => this.asyncInit());
    }

    render() {
      const { files, loading } = this.state;

      console.log("RENDERING FILES", files)

      if(!this.state.collection) {
        return( <InitializePaperCollectionComponent cm={this.cm} initializedCollection={this.initializedCollection}/> )
      }

      return (
        <div className="documentsviewcontainer disable-scrollbars">
          {loading ?
            <div className="fileLoader" ><FadeLoader /></div>
          :
            <FileBrowser ref={this.chonkyRef}
              files={files} view={FileView.SmallThumbs}initializedCollection
              onSelectionChange={this.handleSelectionChange}
              onFileOpen={this.onFileOpen} />
          }
          <div className="refreshDivButton" onClick={() => {this.updateSearchId()}}> Go </div>
          <input className="searchLocation" value={this.state.searchId} onChange={this.changeSearchId} />
        </div>
      )
    }
}