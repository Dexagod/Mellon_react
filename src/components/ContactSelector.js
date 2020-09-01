import * as React from "react";
import "../styles/ContactSelector.css"

import { Contact } from '../util/CommunicationManager'
import { Button } from "@material-ui/core";

export default class ContactSelector extends React.Component{
  constructor(props){
    super(props)
    this.cm = props.cm;
    const contacts = props.contacts || [];
    this.addContact = this.addContact.bind(this)
    this.updateContact = this.updateContact.bind(this)
    this.removeContact = this.removeContact.bind(this)
    this.submit = this.submit.bind(this)

    this.state = {contacts: contacts}
  }

  addContact(){
    const newContact = new Contact(null, "", null);
    this.setState(state => {
      const list = [...state.contacts, newContact];
      return {
        contacts: list
      };
    });
  }

  removeContact(index) {
    let newContacts = [...this.state.contacts]
    newContacts.splice(index, 1)
    this.setState({contacts: newContacts})
  }

  updateContact(index, event) {
    let newContacts = [...this.state.contacts]
    newContacts[index] = new Contact(this.cm, event.target.value, null); // Replace 'this.cm' by null to not fetch contact name
    this.setState({contacts: newContacts})
  }

  submit() {
    this.props.submit(this.state.contacts)
    this.setState({contacts: []})
  }

  render() {
    const contacts = this.state.contacts.map((contact, index) => {return(
      <div className="contactcontainer" key={index} ><input className="contactinput" key={index} value={contact.id} onChange={(e) => {this.updateContact(index, e)}}/><div className="divButton" onClick={() => {this.removeContact(index)}}>X</div></div>
    )})
    return (
      <div className="contactsselector">
        <p>Select contacts to notify</p>
        <p style={{fontSize: "small"}}>People below will be able to read your paper</p>
        <Button variant="outlined" onClick={() => this.addContact()}>Add contact</Button>

        <form>
          {contacts}
        </form>
        <Button color="primary" variant="contained" onClick={() => {this.submit()}}>Submit</Button>
      </div>
    );
  }
}