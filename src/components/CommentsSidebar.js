import React from 'react';
import solid from 'solid-auth-client'
import CommunicationManager from '../util/CommunicationManager';

import AsyncListItemComment from "./AsyncListItemComment"
import List from '@material-ui/core/List';
import CommentAddComponent from './CommentAddComponent';

import "../styles/Sidebar.css"
const REFRESHRATE=20000


export default class CommentsSidebar extends React.Component {

  constructor(props) {
    super(props)
    this.cm = props.cm || new CommunicationManager(solid);

    this.state = {
      commentIds: [],
      commentDates: [],
      canComment: false
    };
    this.update = this.update.bind(this)
    this.updateDate = this.updateDate.bind(this);
    this.getDateForId = this.getDateForId.bind(this);
    this.running = false;
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

    this.running = true
    this.update();
    this.timeout = setInterval(this.update, REFRESHRATE);
  }
  componentWillUnmount() {
    this.running = false;
    clearInterval(this.timeout);
  }

  componentDidUpdate(prevprops, prevstate){
    if(Object.keys(this.props.selection)[0] !== Object.keys(prevprops.selection)[0]){
      this.setState(this.getNewState())
      this.update()
    }
  }

  shouldComponentUpdate(nextprops, nextstate) {
    console.log("check component updates", this.state.commentDates, nextstate.commentDates)
    if (this.state.canComment !== nextstate.canComment) {
      return true;
    }
    if(Object.keys(this.props.selection)[0] !== Object.keys(nextprops.selection)[0]){
      console.log("newProps")
      return true
    }
    if(nextstate.commentIds.length !== this.state.commentIds.length) return true;
    for (let i = 0; i < nextstate.commentIds.length; i++) {
      if (nextstate.commentIds[i] !== this.state.commentIds[i]) {
        console.log("newComment")
        return true;
      }
    }
    if(nextstate.commentDates.length !== this.state.commentDates.length) return true;
    for (let i = 0; i < nextstate.commentDates.length; i++) {
      if (nextstate.commentDates[i] !== this.state.commentDates[i]) {
        console.log("newDates")
        return true;
      }
    }
    console.log("nothing")
    return false;
  }

  updateDate(updateObj) {
    console.log("updating date", updateObj)
    let newCommentDates = this.state.commentDates.slice();
    for (let i = 0; i < newCommentDates.length; i++){
      if(newCommentDates[i].id === updateObj.id) {
        //the date as already been set once
        return;
      }
    }
    newCommentDates.push(updateObj)
    this.setState({commentDates: newCommentDates})
  }

  async update(){
    if(this.updaterunning) {return}
    this.updaterunning = true;
    const documentMetadata = Object.values(this.props.selection)[0]
    console.log("updating comments", documentMetadata.title)
    let commentIds = (await this.cm.getPaperCommentIds(documentMetadata))
    if(commentIds)
      this.setState({commentIds: commentIds});
    this.updaterunning = false;
  }

  getDateForId(id){
    let commentDates = this.state.commentDates
    for (let e of commentDates){
      if(e.id === id) {
        return e
      }
    }
    return {id: id, date: null};
  }

  render(){
    let idsWithDates = this.state.commentIds.map(commentId => this.getDateForId(commentId))
    console.log("idsWithDates", JSON.stringify(idsWithDates, null, 2))
    idsWithDates.sort(function(a, b) {console.log("comparing", JSON.stringify(a), JSON.stringify(b)); if(!b.date) return a; if(!a.date) return b; return b.date.getTime() - a.date.getTime()})
    console.log("sortedComments", JSON.stringify(idsWithDates, null, 2))
    let commentsList = idsWithDates.map(commentId => {return(
      <AsyncListItemComment key={commentId.id} id={commentId.id} selection={this.props.selection} updateDate={this.updateDate} cm={this.cm}/>
    )})

    return (
      <div className="commentContainer">
        <div className="uppercontainer">
          {commentsList.length ? <p>Comments</p> : null}
          <List className="disable-scrollbars">
            {commentsList}
          </List>
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


