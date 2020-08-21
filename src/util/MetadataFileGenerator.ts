import { PaperMetadata } from './CommunicationManager';
import { DataFactory, Writer, Quad } from "n3";

import {AS, XSD, RDF, RDFS, DCTERMS } from '@inrupt/vocab-common-rdf'
const RESEARCH_PAPER_CLASS = "http://example.com/ResearchPaper";
const HYDRA = "http://www.w3.org/ns/hydra/core#";
const SIOC = "http://rdfs.org/sioc/ns#";

const { namedNode, literal, quad } = DataFactory;

export default class MetadataFileGenerator {
  static async generatePaperCollection(
    collectionId: string,
    partialCollectionViewId: string
  ): Promise<string> {
    const quadList = [
      quad(namedNode(collectionId), namedNode(RDF + 'type'), namedNode(HYDRA + 'collection')),
      quad(namedNode(collectionId), namedNode(DCTERMS + 'description'), literal("Collection of research papers")),
      quad(namedNode(collectionId), namedNode(HYDRA + 'view'), namedNode(partialCollectionViewId))
    ]
    return await this.quadListToTTL(quadList);
  }

  // Add the paper id as a member to the collection
  // Add the collection of comments for the paper

  static async generatePaperEntry(collectionURI: string, paperURI: string, metadata: PaperMetadata): Promise<string> {
    let quadList = []
    quadList.push(quad(namedNode(collectionURI), namedNode(HYDRA + "member"), namedNode(paperURI)));
    quadList.push(quad(namedNode(paperURI), namedNode(RDF + "type"), namedNode(RESEARCH_PAPER_CLASS)));
    if(metadata) {
      metadata.title && 
        quadList.push(quad(namedNode(paperURI), namedNode(DCTERMS + 'title'), literal(metadata.title)))          
      metadata.metadatalocation &&
        quadList.push(quad(namedNode(paperURI), namedNode(RDFS + "seeAlso"), literal(metadata.metadatalocation)))        
      metadata.publisher &&
        quadList.push(quad(namedNode(paperURI), namedNode(DCTERMS + "publisher"), literal(metadata.publisher)))     
    }
    return this.quadListToTTL(quadList)
  }

  static async createComment(
    commentId: string,
    articleId: string,
    userWebId: string,
    content: string
  ): Promise<{ metadata: string, payload: string, notification: string }> {
    const now = new Date();
    const metadataQuads = [
      quad(namedNode(commentId), namedNode(RDF + 'type'), namedNode(SIOC + 'Post')),
      quad(namedNode(commentId), namedNode(SIOC + 'reply_of'), namedNode(articleId)),
      quad(namedNode(commentId), namedNode(SIOC + 'created_at'), literal(now.toISOString(), namedNode(XSD + 'dateTime'))),
      quad(namedNode(commentId), namedNode(SIOC + 'has_creator'), namedNode(userWebId))
    ]

    const note = "This post was created using the Mellon web application"
    const payloadQuads = metadataQuads.concat([
      quad(namedNode(commentId), namedNode(SIOC + 'content'), literal(content)),
      quad(namedNode(commentId), namedNode(SIOC + 'note'), literal(note)),
    ])
  
    const comment = "Comment by ' + userWebId + ' over ' + articleId + '"
    const notificationQuads = [
      quad(namedNode(''), namedNode(RDF + 'type'), namedNode(AS + 'Announce')),
      quad(namedNode(''), namedNode(RDFS + 'comment'), literal(comment)),
      quad(namedNode(''), namedNode(AS + 'published'), literal(now.toISOString(), namedNode(XSD + 'dateTime'))),
      quad(namedNode(''), namedNode(AS + 'actor'), namedNode(userWebId)),
      quad(namedNode(''), namedNode(AS + 'object'), namedNode(commentId)),

      quad(namedNode(commentId), namedNode(RDF + 'type'), namedNode(SIOC + 'Post')),
      quad(namedNode(commentId), namedNode(SIOC + 'reply_of'), namedNode(articleId)),
      quad(namedNode(commentId), namedNode(SIOC + 'created_at'), literal(now.toISOString(), namedNode(XSD + 'dateTime'))),
      quad(namedNode(commentId), namedNode(SIOC + 'has_creator'), namedNode(userWebId)),
    ]
    return {
      metadata: await this.quadListToTTL(metadataQuads),
      payload: await this.quadListToTTL(payloadQuads),
      notification: await this.quadListToTTL(notificationQuads)
    };
  }


  static async createPaperPublishedNotification(userWebId: string, paperId: string, paperTitle: string) : Promise<string> {
    const now = new Date()
    let notificationQuads = [
      quad(namedNode(''), namedNode(RDF + 'type'), namedNode(AS + 'Announce')),
      quad(namedNode(''), namedNode(RDFS + 'comment'), literal(userWebId + ' just published ' + paperTitle + ' at ' + paperId)),
      quad(namedNode(''), namedNode(AS + 'published'), literal(now.toISOString(), namedNode(XSD + 'dateTime'))),
      quad(namedNode(''), namedNode(AS + 'actor'), namedNode(userWebId)),
      quad(namedNode(''), namedNode(AS + 'object'), namedNode(paperId)),

      quad(namedNode(paperId), namedNode(RDF + 'type'), namedNode(RESEARCH_PAPER_CLASS)),
      quad(namedNode(paperId), namedNode(DCTERMS + 'publisher'), namedNode(userWebId)),
    ]
    if (paperTitle) notificationQuads.push(quad(namedNode(paperId), namedNode(DCTERMS + 'title'), literal(paperTitle)))
    return await this.quadListToTTL(notificationQuads)
  }

  static async initializeMetadataFile(metadataURI: string, paperURI: string, metadata?: PaperMetadata) {
    const contentQuads = [
      quad(namedNode(metadataURI), namedNode(RDFS + 'subject'), namedNode(paperURI)),
      quad(namedNode(metadataURI), namedNode(RDFS + 'comment'), literal("This is the metadata file for " + paperURI)),
    ]
    if (metadata) { 
      if (metadata.title) contentQuads.push(quad(namedNode(metadataURI), namedNode(DCTERMS + 'title'), literal(metadata.title)))
      if (metadata.publisher) contentQuads.push(quad(namedNode(metadataURI), namedNode(DCTERMS + 'publisher'), namedNode(metadata.publisher)))
    }
    return await this.quadListToTTL(contentQuads)
  }

  static async quadListToTTL(quadList : Array<Quad>) : Promise<string> { 
    return new Promise((resolve, reject) => {
      const writer = new Writer();
      writer.addQuads(quadList)
      writer.end((error, result) => {
        if (error || !result) reject(error || "Could not generate ttl file from quads")
        resolve(result)
      });
    })
  }
}

