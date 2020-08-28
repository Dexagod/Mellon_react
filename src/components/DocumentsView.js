// Import React as usual
import React from 'react';
import AutoComplete from '@material-ui/lab/Autocomplete';
import { TextField, CircularProgress, Snackbar, Button } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import SearchIcon from '@material-ui/icons/Search';

// Import Chonky
import 'chonky/style/main.css';
import {FileBrowser, FileView} from 'chonky';

import solid from 'solid-auth-client'
import CommunicationManager from '../util/CommunicationManager';
import InitializePaperCollectionComponent from "./InitializePaperCollectionComponent"

import "../styles/DocumentsView.css"


export default class DocumentsView extends React.Component {
    constructor(props) {
        super(props);

        this.cm = props.cm || new CommunicationManager(solid);
        this.fileData = new Map()
        this.webId = ""
        this.state = {
            searchId: "",
            files: [],
            hasCollection: false,
            loading: true,
            showAlert: false
        };

        this.chonkyRef = React.createRef();
        this.handleSelectionChange = this.handleSelectionChange.bind(this)
        this.changeSearchId = this.changeSearchId.bind(this)
        this.search = this.search.bind(this)
        this.initializedCollection = this.initializedCollection.bind(this)
        this.onFileOpen = this.onFileOpen.bind(this)
    }

    componentDidMount(){
      this.asyncInit();
    }

    componentDidUpdate(prevProps) {
      // This code is in a function so it can be executed after the state changed below
      const updateSelect = (updateCollection = false) => {
        if (prevProps.updateSelection !== this.props.updateSelection) {
          // Update files first because this probably get's called when new file uploaded
          this.search(() => this.selectFile(this.props.selectFile));
        } else if (updateCollection) {
          this.search();
        }
      }
      if (prevProps.updateSearch !== this.props.updateSearch && this.props.searchId) {
        this.setState({ searchId: this.props.searchId }, updateSelect(true));
      } else {
        updateSelect();
      }
    }

    async asyncInit() {
      const webId = await this.cm.getCurrentWebID()
      if(!webId) { this.setState({ loading: false }); return; }
      // If there is one or more collections
      const hasCollection = (await this.cm.getPaperCollections(webId)).length > 0;

      this.setState({
        searchId: webId,
        hasCollection: hasCollection
      }, () => {
        this.asyncUpdate(this.state.searchId)
      });
    }

    async asyncUpdate(searchId, afterUpdateCallback = () => {}){
      console.log("getting", this.state, this.state.webId)
      if(!this.state.hasCollection) { this.setState({ loading: false }); return; }
      const webId = searchId
      const fileData = new Map();
      let documents = await this.cm.getResearchPapers(webId);
      if(!documents || documents.length === 0) {
        this.setState({ files: [], loading: false }, afterUpdateCallback);
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
      if (!(fileURI && fileURI.length)) { this.chonkyRef.current.setSelection(); return; }
      let selection = {};
      for (let file of this.state.files) {
        if (file.id === fileURI) {
          selection[fileURI] = true;
          this.chonkyRef.current.setSelection(selection);
          return;
        }
      }
      // The file was not found
      this.setState({ showAlert: true });
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

    changeSearchId(event, newInputValue){
      this.setState({ searchId: newInputValue })
    }

    search(afterUpdateCallback = () => {}){
      this.setState({ loading: true }, () => this.asyncUpdate(this.state.searchId, afterUpdateCallback));
    }

    initializedCollection() {
      this.setState({ loading: true }, () => this.asyncInit());
    }

    render() {
      const { files, loading } = this.state;

      console.log("RENDERING FILES", files)

      if (!this.state.hasCollection) {
        return( <InitializePaperCollectionComponent cm={this.cm} initializedCollection={this.initializedCollection}/> )
      }

      const closeAlert = (event, reason) => {
        if (reason === 'clickaway') { return; }
        this.setState({ showAlert: false });
      };

      return (<>
        <div className="documentsviewcontainer disable-scrollbars">
          {loading ?
            <div className="fileLoader" ><CircularProgress /></div>
          :
            <FileBrowser ref={this.chonkyRef}
              files={files} view={FileView.SmallThumbs}
              onSelectionChange={this.handleSelectionChange}
              onFileOpen={this.onFileOpen} />
          }
          <form onSubmit={(event) => { event.preventDefault(); this.search() }}>
            <div className="refreshDivButton"><Button color="primary" variant="outlined" onClick={() => this.search()}><SearchIcon /></Button></div>
            <AutoComplete className="searchLocation" autoFocus freeSolo
              onInputChange={this.changeSearchId}
              onChange={() => this.search()}  // Update when selecting option
              value={this.state.searchId}
              options={(this.props.me ? [this.props.me] : []).concat(this.props.contacts)}
              renderOption={(option) => ContactListElement(option)}
              getOptionLabel={(option) => option.id ? option.id : option}
              filterOptions={(options, { inputValue }) => {
                inputValue = inputValue.trim().toLowerCase();
                return options.filter(({ name, id }) =>
                  (name !== undefined && name.toLowerCase().includes(inputValue)) ||
                    (id !== undefined && id.toLowerCase().includes(inputValue))
                );
              }}
              renderInput={(params) => <TextField variant="outlined" {...params} />}
            />
          </form>
        </div>
        <Snackbar open={this.state.showAlert} autoHideDuration={3000} onClose={closeAlert}>
					<Alert variant="filled" onClose={closeAlert} severity="warning" >
					{`This file could not be found`}
					</Alert>
				</Snackbar>
      </>)
    }
}

const ContactListElement = ({ name, id }) => {
  return (<>
      <h6>{name}</h6><br />
      <p className="contactListWebID">{id}</p>
      <hr />
    </>)
}