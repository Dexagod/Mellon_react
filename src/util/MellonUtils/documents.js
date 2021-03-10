import { getVal, getValArray } from "../../singletons/QueryEngine";
import ns from "../NameSpaces";
import { putFile, patchFile, postFile } from "../FileUtil";
import { getError } from "../../Errors/errors";
import { createACL, createPermission, MODES } from "../PermissionManager";
import { fetchProfile } from "./profile";
import { getBaseIRI } from "../Util";
import { getInboxAgent } from "singletons/InboxAgent";

import { DataFactory as df } from "n3"

import * as f from "@dexagod/rdf-retrieval"

/**
 * Check profile for a publications collection
 * @param {string} webId 
 */
const getDocumentsCollection = async (webId) => await getVal(webId, ns.ex('publications'));


const createDocumentMetadatFileId = (documentId, metadataExtention) => {
  metadataExtention = metadataExtention || '.meta'
  return `${documentId}${metadataExtention}`
  // const split = documentId.split('.');
  // return split.slice(0, split.length-1).join('.') + '_meta.' + (metadataExtention || 'ttl')
}

// const getCollectionMemberSeeAlso

/**
 * Get the documents metadata from the publications collection
 * @param {string} webId 
 */
const getDocumentAndMetadataIds = async (webId) => {
  const documentIds = await getValArray(webId, ns.ex('publications'), ns.hydra('member'));
  const documentMetadataFileId = await getValArray(webId, ns.ex('publications'), ns.hydra('member'), ns.rdfs('isDefinedBy'));
  const documentsMetadata = []
  for (const [index, documentId] of documentIds.entries()) {
    documentsMetadata.push({id: documentId, metadataId: documentMetadataFileId[index]})
  }
  return documentsMetadata
}

const getDocumentMetadata = async (documentId, metadataId) => {
  console.log('testing', `${await getVal(metadataId, documentId)}`)
  const metadata = {
    id: metadataId,
    type: await getVal(metadataId, ns.rdf('type')),
    title: await getVal(metadataId, ns.ex('title')),
    keywords: await getValArray(metadataId, ns.ex('keywords')),
    date: await getVal(metadataId, ns.ex('date')),
    authors: await getValArray(metadataId, ns.ex('authors')),
    abstract: await getVal(metadataId, ns.ex('abstract')),
    comments: await getVal(metadataId, ns.ex('comments')),
  }
  metadata.date = metadata.date && new Date(metadata)
  return metadata
}

const createDocumentMetadataContent = (documentMetadata, documentId) => {
  return `
    @prefix ex: <${ns.ex('')}> .
    @prefix xsd: <${ns.xsd('')}> .
    <> a ex:Publication ;
      ex:title "${documentMetadata.title}" ;
      ex:keywords "${documentMetadata.keywords.join('", "')}" ;
      ex:date "${documentMetadata.date}"^^xsd:date ;
      ex:authors <${documentMetadata.authors.join('>, <')}> ;
      ex:abstract "${documentMetadata.abstract}" .
  `
}

const createCollectionPatchBody = async (webId, documentId) => {
  const collectionId = await getDocumentsCollection(webId)
  const metadataFileId = await createDocumentMetadatFileId(documentId)
  return `INSERT { 
    <${collectionId}> <${ns.hydra('member')}> <${documentId}>.
    <${documentId}> <${ns.rdfs('isDefinedBy')}> <${metadataFileId}> .
  }`
}

const getFileUploadURI = (file, location) => {
  if (!location) return;
  if (!location.endsWith("/")) location = location + "/";
  return location + file.name;
}

const checkAndThrowErrors = (response, URI, requestBody) => {
  if (response.code >= 400 && response.code < 500) throw new getError(URI, response, requestBody)
}

const uploadDocument = async (documentMetadata, webId) => {
  const documentId = getFileUploadURI(documentMetadata.file, documentMetadata.location)
  const documentMetadataId = createDocumentMetadatFileId(documentId)
  const put = putFile(documentId, documentMetadata.file)
  checkAndThrowErrors(put, documentId, documentMetadata.file.name)
  
  // Document is uploaded. Now a metadata file is generated.
  const metadataBody = createDocumentMetadataContent(documentMetadata, documentId)
  const metadataput = await putFile(documentMetadataId, metadataBody, {"Content-Type": 'text/turtle'})
  checkAndThrowErrors(metadataput, documentMetadataId, metadataBody)
  
  // Update collection
  const patchBody = await createCollectionPatchBody(webId, documentId)
  const patch = await patchFile(webId, patchBody)
  checkAndThrowErrors(patch, webId, patchBody)

  
  // load contacts to give read permissions
  // const profile = await fetchProfile(webId)

  // Set public permissions
  const contacts = null // (profile && profile.contacts) || []     
  // Create acl file for the document, and set read permissions for all contacts
  await createACL(webId, documentId,
    [createPermission([MODES.READ], contacts)]
  );

  // Create acl file for the document metadata file, and set read permissions for all contacts
  await createACL(webId, documentMetadataId,
    [createPermission([MODES.READ, MODES.APPEND], contacts)]
  );

  // const metadataFileId = await getDocumentMetadataId(webId, documentId);
  // console.log('got metadata', metadataFileId)
  // // Notify contacts
  // const notificationBody = createPublicationUploadNotification(webId, documentId, metadataFileId)
  // const agent = getInboxAgent(webId) 
  // agent.sendNotification({notification: notificationBody, to: contacts})
  
  return documentId

}

const getDocumentMetadataId = async (webId, documentId) => {
  const documentsAndMetadata = await getDocumentAndMetadataIds(webId);
  const documentIds = documentsAndMetadata.filter(e => e.id === documentId)
  return documentIds[0] && documentIds[0].metadataId
}

const createComment = (commentData) => {
  return `
    @prefix sioc: <${ns.sioc('')}> .
    @prefix xsd: <${ns.xsd('')}> .
    <> a sioc:Post ;
     sioc:reply_of <${commentData.reply_of}> ;
     sioc:created_at "${commentData.created_at}"^^xsd:date ;
     sioc:has_creator "${commentData.has_creator}" ;
     sioc:content <${commentData.content}> ;
     sioc:note "${commentData.node}" .
  `
}

const createCommentNotifications = (webId, commentId, commentData) => {
  return `
    @prefix as: <${ns.as('')}> .
    @prefix sioc: <${ns.sioc('')}> .
    <> a as:Announce ;
      as:actor <${webId}> ;
      as:object [ 
        a as:Create ;
        as:actor <${webId}>  ;
        as:object <${commentId}> ;
        as:target <${commentData.reply_of}> ;
      ] ;
      as:summary "${webId} created a new comment on ${commentData.reply_of}." .
    <${commentId}> a sioc:Post ;
      sioc:reply_of <${commentData.reply_of}> .
  `
}

const createPublicationUploadNotification = (webId, documentId, metadataId) => {
  return `
    @prefix as: <${ns.as('')}> .
    @prefix rdfs: <${ns.rdfs('')}> .
    @prefix ex: <${ns.ex('')}> .
    <> a as:Announce ;
      as:actor <${webId}> ;
      as:object [ 
        a as:Create ;
        as:actor <${webId}>  ;
        as:object <${documentId}> ;
      ] ;
      as:summary "${webId} uploaded a new publication." .
    <${documentId}> a ex:Publication ;
      rdfs:isDefinedBy <${metadataId}> .
  `
}


const createAndPostComment = async (webId, commentData, metadataId) => {
  if (!commentData.documentId || !commentData.has_creator) {
    return false;
  }
  
  // Create comment body
  const commentbody = createComment(commentData)
  // Create comment file
  const postresponse = await postFile(commentData.location, commentbody)
  checkAndThrowErrors(postresponse, commentData.location, commentbody)
  const relativeCommentLocation = Object.fromEntries(postresponse.headers).location
  const absoluteCommentLocation = getBaseIRI(commentData.has_creator) + relativeCommentLocation.slice(1) // TODO:: is this the best way? webId base IRI , remove starting / for second part
  console.log('commentLocation', absoluteCommentLocation)

  await createACL(webId, absoluteCommentLocation,
    [createPermission([MODES.READ], null)] // make comment publicly readable
  );

  // // // Update metadata information with link to comment
  const patchBody = `INSERT { <${commentData.reply_of}> <${ns.ex('comments')}> <${absoluteCommentLocation}> }` 
  const response = await patchFile(metadataId, patchBody)
  checkAndThrowErrors(response, metadataId, patchBody)

  // // send notifications of comment to all contacts
  // const commentNotification = createCommentNotifications(webId, absoluteCommentLocation, commentData)
  // const profile = await fetchProfile(webId) || null
  // let contacts = (profile && profile.contacts) || [];
  // const agent = getInboxAgent(webId) 
  // agent.sendNotification({notification: commentNotification, to: contacts})

  return true
}


/**
 * Create a publication in the requested format
 * @param {{title: string, keywords: string[], authors: string[], abstract: string, file: string, description: string, eventStream: string}} publicationData 
 * @param {string} contentType 
 */
const createPublicationRDF = async (publicationData, contentType) => {
  contentType = contentType || "text/turtle"
  const quads = []
  if (publicationData.title) 
    quads.push(df.quad(df.namedNode(), df.namedNode(ns.ex('Title')), df.namedNode(publicationData.title)))
  
  if (publicationData.keywords && publicationData.keywords.length) 
    for (let keyword of publicationData.keywords) 
      quads.push(df.quad(df.namedNode(), df.namedNode(ns.ex('Keyword')), df.namedNode(keyword)))
  
  if (publicationData.authors) 
    for (let author of publicationData.authors) 
      quads.push(df.quad(df.namedNode(), df.namedNode(ns.ex('Author')), df.namedNode(author)))
    
  if (publicationData.abstract) 
    quads.push(df.quad(df.namedNode(), df.namedNode(ns.ex('Abstract')), df.namedNode(publicationData.abstract)))

  if (publicationData.file) 
    quads.push(df.quad(df.namedNode(), df.namedNode(ns.ex('File')), df.namedNode(publicationData.file)))

  if (publicationData.description) 
    quads.push(df.quad(df.namedNode(), df.namedNode(ns.ex('description')), df.namedNode(publicationData.description)))

  if (publicationData.eventStream) 
    quads.push(df.quad(df.namedNode(), df.namedNode(ns.ex('LifecycleEvents')), df.namedNode(publicationData.eventStream)))

  return await f.quadArrayToString(quads, contentType)
}
    


export {checkAndThrowErrors, getDocumentsCollection, getDocumentAndMetadataIds, uploadDocument, getDocumentMetadata, createDocumentMetadatFileId, createAndPostComment, getDocumentMetadataId, createPublicationRDF}


