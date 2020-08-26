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

export default class APP extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      webId: "",
      selection: [],
      refreshFiles: 0,
      sideBarVisible: false,
      updateSelection: 0,
      me: null,
      contacts: []
    };
    this.cm = new CommunicationManager(solid)
    this.handleSelection = this.handleSelection.bind(this);
    this.toggleSideBar = this.toggleSideBar.bind(this);
  }

  async componentDidMount() {
    const contactsUpdated = () => {
      // TODO: this.forceRefresh() is better?
      this.setState(old => ({ contacts: [...old.contacts]}))
    }
    const fetchContacts = async () => {
      this.setState({
        contacts: (await this.cm.getContacts(this.state.webId)).map(id => new Contact(this.cm, id, contactsUpdated))
      })
    }
    solid.trackSession(session => {
      if (!session) {
        this.setState({webId: "", myInfo: {}, contacts: []})
      } else {
        this.setState({webId: session.webId, me: new Contact(this.cm, session.webId, contactsUpdated) },
          fetchContacts  // Fetch contacts after logged in
        );
      }
    })
  }

  async fetchContacts() {
    this.setState({
      contacts: (await this.cm.getContacts(this.state.webId)).map(id => ({ id }))
    }, this.fetch)
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
              fileUploaded={(fileURI) => this.setState(old => ({ selectFile: fileURI, updateSelection: old.updateSelection + 1 }))}/> // After upload, select file
    return (
      <div>
        <h3>{Object.values(this.state.selection)[0].name}</h3>
        <AccessController selection={this.state.selection} cm={this.cm}
          fileRemoved={() => this.setState(old => ({ selectFile: null, updateSelection: old.updateSelection + 1 }))} />
        <CommentsSidebar selection={this.state.selection} cm={this.cm} />
      </div>)
  }

  toggleSideBar() {
    this.setState(old => ({ sideBarVisible: !old.sideBarVisible }));
  }

  render(){
    console.log("YEEEEEE RENDERRRR")
    console.dir(this.state)
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
            <div className="maincontentcontainer col">
              <MainContent handleSelection={this.handleSelection} cm={this.cm}
                selectFile={this.state.selectFile} updateSelection={this.state.updateSelection}
                me={this.state.me} contacts={this.state.contacts} />
            </div>
            {this.state.sideBarVisible ? (
              <>
                <div className="sidebarcontainer col-md-4">
                  { this.getSidebar() }
                </div>
                <div className="sidebarexpand" onClick={this.toggleSideBar}>&gt;</div>
              </>
            ) : (
              <div className="sidebarexpand" onClick={this.toggleSideBar}>&lt;</div>
            )}
          </div>
      </div>
    );
  }
}
