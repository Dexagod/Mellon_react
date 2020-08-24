import React, { useState } from 'react';
import solid from 'solid-auth-client'
import CommunicationManager from '../util/CommunicationManager';
import DocumentsView from './DocumentsView';
import "../styles/MainContent.css"



export default class InitializePaperCollectionComponent extends React.Component {

  constructor(props){
    super(props)
    this.cm = props.cm || new CommunicationManager(solid)
  }

  async initializeCollection() {
    await this.cm.initializeResearchPaperStorage(
      await this.cm.getCurrentWebID()
    );
    this.props.initializedCollection()
  }


  render () {
    return (
      <button onClick={ () => {this.initializeCollection()}}>Initialize collection to store research papers</button>
    )
  }
}
