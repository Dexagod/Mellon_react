import React from 'react';
import solid from 'solid-auth-client'
import CommunicationManager from '../util/CommunicationManager';

import AsyncListItemComment from "./AsyncListItemComment"
import List from '@material-ui/core/List';
import CommentAddComponent from './CommentAddComponent';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

import "../styles/Sidebar.css"
import { Button } from '@material-ui/core';
const REFRESHRATE=20000


export default class CommentsSidebar extends React.Component {

  constructor(props) {
    super(props)
    this.cm = props.cm || new CommunicationManager(solid);
    this.loadSize = 2

    this.state = {
      comments: [],
      canComment: false,

      startIndex: 0,
      endIndex: this.loadSize,
      allLoaded: true
    };
    this.update = this.update.bind(this)
    this.showMore = this.showMore.bind(this)
    this.timeout = null;
    this.updaterunning = false;
  }

  getNewState(){
    return ({ commentIds: [], commentDates: [] })
  }

  async componentDidMount() {
    const documentMetadata = Object.values(this.props.selection)[0];
    // Check if user can comment
    const patch = await this.cm.fu.patchFile(
      documentMetadata.metadatalocation || this.cm.getMetadataURI(documentMetadata.id),
      ""
    );
    this.setState({ canComment: patch.status !== 403 });

    this.update();
    this.timeout = setInterval(this.update, REFRESHRATE);
  }
  componentWillUnmount() {
    clearInterval(this.timeout);
  }

  componentDidUpdate(prevprops, prevstate){
    if(Object.keys(this.props.selection)[0] !== Object.keys(prevprops.selection)[0]){
      this.setState(this.getNewState())
      this.update()
    }
  }

  shouldComponentUpdate(nextprops, nextstate) {
    if (this.state.canComment !== nextstate.canComment) {
      return true;
    }
    if (this.state.startIndex !== nextstate.startIndex || this.state.endIndex !== nextstate.endIndex) {
      console.log("Render more/less comments");
      return true;
    }
    if(Object.keys(this.props.selection)[0] !== Object.keys(nextprops.selection)[0]){
      console.log("The selection changed")
      return true
    }
    if(nextstate.comments.length !== this.state.comments.length) {
      console.log("Comments were removed or added");
      return true;
    }
    for (let i = 0; i < nextstate.comments.length; i++) {
      if (nextstate.comments[i].id !== this.state.comments[i].id) {
        console.log("A comment was gone, a new one added")
        return true;
      }
    }
    return false;
  }

  async update(){
    if(this.updaterunning) {return}
    this.updaterunning = true;
    const documentMetadata = Object.values(this.props.selection)[0]
    console.log("updating comments", documentMetadata.title)
    let comments = (await this.cm.getPaperComments(documentMetadata))
    comments.sort((a, b) => { return b.createdAt.getTime() - a.createdAt.getTime()})
    if(comments)
      this.setState(state => ({comments, allLoaded: state.startIndex === 0 && state.endIndex >= comments.length}));
    this.updaterunning = false;
  }

  showMore() {
    this.setState(state => ({
      endIndex: state.endIndex + this.loadSize,
      allLoaded: state.startIndex === 0 && state.endIndex  + this.loadSize >= state.comments.length
    }));
  }

  render(){
    let commentsList = this.state.comments
      .slice(this.state.startIndex, this.state.endIndex)
      .map(comment =>
        <AsyncListItemComment key={comment.id} comment={comment} selection={this.props.selection} cm={this.cm}/>
      )

    return (
      <div className="commentContainer">
        <div className="uppercontainer">
          {commentsList.length ? <p>Comments</p> : null}
          <List className="disable-scrollbars">
            {commentsList}
          </List>
          {!this.state.allLoaded ? <Button onClick={this.showMore} endIcon={<ExpandMoreIcon />}>Show more</Button> : null}
        </div>

        {this.state.canComment ?
          (<div className="lowercontainer disable-scrollbars">
            <CommentAddComponent className="commentAdd" selection={this.props.selection}/>
          </div>)
          : (null)
        }
      </div>
    );
  }
}


