import React from 'react';
import solid from 'solid-auth-client'
import CommunicationManager from '../util/CommunicationManager';
import DocumentsView from './DocumentsView';
import "../styles/MainContent.css"



export default class MainContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
        selection: []
    };
    this.handleSelection = this.handleSelection.bind(this);
    this.cm = props.cm || new CommunicationManager(solid);
  }

  handleSelection(selection) {
    this.props.handleSelection(selection)
  }


  render () {
    const view = <DocumentsView handleSelection={this.handleSelection} cm={this.cm}
      searchId={this.props.searchId} updateSearch={this.props.updateSearch}
      selectFile={this.props.selectFile} updateSelection={this.props.updateSelection}
      me={this.props.me} contacts={this.props.contacts} />
    return (
      <div className="maincontent">
        {view}
      </div>
    )
  }
}
