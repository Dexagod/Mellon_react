import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import NavbarComponent from './components/NavbarComponent'
import CommentsSidebar from './components/CommentsSidebar';
import MainContent from './components/MainContent';
import NotificationsSideBar from 'components/NotificationsSideBar';
import CommunicationManager, { Contact } from 'util/CommunicationManager';
import solid from 'solid-auth-client';
import { AccessController } from 'components/AccessController';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { Button, Paper, Divider } from '@material-ui/core';

export default class APP extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      webId: "",
      selection: [],
      sideBarVisible: false,
      updateSelection: 0,
      updateSearch: 0,
      me: null,
      contacts: []
    };
    this.cm = new CommunicationManager(solid)
    this.handleSelection = this.handleSelection.bind(this);
    this.toggleSideBar = this.toggleSideBar.bind(this);
    this.navigateToFile = this.navigateToFile.bind(this);
  }

  async componentDidMount() {
    const contactsUpdated = () => {
      this.setState(old => ({ contacts: [...old.contacts]}))
    }
    const fetchContacts = async () => {
      this.setState({
        contacts: (await this.cm.getContacts(this.state.webId)).map(id => new Contact(this.cm, id, contactsUpdated))
      })
    }
    solid.trackSession(session => {
      if (!session) {
        this.setState({webId: "", me: new Contact(null, "", null), contacts: []})
      } else {
        this.setState(state => ({
          webId: session.webId,
          me: new Contact(this.cm, session.webId, contactsUpdated),
          sideBarVisible: false,
          selectFile: null, updateSelection: state.updateSelection + 1
        }),
          fetchContacts  // Fetch contacts after logged in
        );
      }
    })
  }

  handleSelection(newSelection) {
    console.log("selected", "old", this.state.selection, "new", newSelection)
    this.setState({
      selection: newSelection,
      // Show sidebar if file selected
      sideBarVisible: Object.keys(newSelection).length > 0
    })
  }

  getSidebar(){
    if(Object.keys(this.state.selection).length === 0)
      return <NotificationsSideBar selection={this.state.selection} cm={this.cm}
              navigateToFile={this.navigateToFile}
              me={this.state.me} contacts={this.state.contacts} />
    return (
      <Paper variant="elevation" elevation={10} className="sidebarcomponentcontainer col-md-5">
        <h3>{Object.values(this.state.selection)[0].name}</h3>
        <AccessController selection={this.state.selection} cm={this.cm}
          fileRemoved={() => this.navigateToFile()}
          contacts={this.state.contacts} />
        <Divider />
        <CommentsSidebar selection={this.state.selection} cm={this.cm} />
      </Paper>)
  }

  /* Select file fileURI, after navigating to profile profileURI if that is not null
    If both null, de-selects selected item
  */
  navigateToFile(fileURI = null, profileURI = null) {
    let newState = {};
    if (profileURI !== null) {
      newState.searchId = profileURI;
      newState.updateSearch = this.state.updateSearch + 1;  // Re-render filebrowser with this prop
    }
    newState.selectFile = fileURI;
    newState.updateSelection = this.state.updateSelection + 1;  // Re-render filebrowser with this prop
    this.setState(newState, () => console.log(this.state));
  }

  toggleSideBar() {
    this.setState(old => ({ sideBarVisible: !old.sideBarVisible }));
  }

  render(){
    if(!this.state.webId){
      return (
        <div className="App">
            <NavbarComponent className="navbar" cm={this.cm}/>
            <p>Please login</p>
        </div>
      )
    }
    return (
      <div className="App">
          <NavbarComponent className="navbar" cm={this.cm}/>
          <div className="contentcontainer row">
            <Paper variant="outlined" className="maincontentcontainer col">
              <MainContent handleSelection={this.handleSelection} cm={this.cm}
                searchId={this.state.searchId} updateSearch={this.state.updateSearch}
                selectFile={this.state.selectFile} updateSelection={this.state.updateSelection}
                me={this.state.me} contacts={this.state.contacts} />
            </Paper>
            {this.state.sideBarVisible ? (
              <>
                { this.getSidebar() }
                <div className="button-sidebarexpand"><Button variant="contained" color="primary" onClick={this.toggleSideBar} ><ChevronRightIcon/></Button></div>
              </>
            ) : (
              <div className="button-sidebarexpand"><Button variant="contained" color="primary" onClick={this.toggleSideBar} ><ChevronLeftIcon/></Button></div>
            )}
          </div>
      </div>
    );
  }
}
