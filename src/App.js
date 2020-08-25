import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import NavbarComponent from './components/NavbarComponent'
import CommentsSidebar from './components/CommentsSidebar';
import MainContent from './components/MainContent';
import NotificationsSideBar from 'components/NotificationsSideBar';
import CommunicationManager from 'util/CommunicationManager';
import solid from 'solid-auth-client'
import CommentAddComponent from 'components/CommentAddComponent';
import { AccessController } from 'components/AccessController';

export default class APP extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      webId: "",
      selection: [],
      refreshFiles: 0,
      sideBarVisible: false,
      updateSelection: 0
    };
    this.cm = new CommunicationManager(solid)
    this.handleSelection = this.handleSelection.bind(this);
    this.toggleSideBar = this.toggleSideBar.bind(this);
  }

  componentDidMount(){
    solid.trackSession(session => {
      if (!session)
        this.setState({webId: ""})
      else
        this.setState({webId: session.webId})
    });
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
                selectFile={this.state.selectFile} updateSelection={this.state.updateSelection} />
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
