import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/storage';
import 'firebase/auth';
import getStore from '../../../utils/honestyStore';

class DataController {
  constructor() {
    this.storage = firebase.storage().ref();
    this.db = firebase.firestore();
  }

  async getItemClasses() {
    const items = await this.db.collection('item_data').get();
    const classes = [];
    items.forEach(doc => {
      if (doc.data().count > 0) classes.push(doc.id);
    });
    return classes;
  }

  changeItemCount(label, change) {
    const ref = this.db.collection('item_data').doc(label);
    return ref
      .get()
      .then(doc =>
        ref.set({count: (doc.exists ? doc.data().count : 0) + change})
      );
  }

  addImage(imageUri, label) {
    return Promise.all([
      this.db
        .collection('training_data')
        .add({
          label,
          random: Math.random(),
          timestamp: Date.now(),
          trusted: false
        })
        .then(doc =>
          this.storage
            .child(`training_data/${label}/${doc.id}.jpg`)
            .putString(imageUri, 'data_url')
        ),
      this.changeItemCount(label, 1)
    ]);
  }

  trustImage(imageId) {
    return this.db
      .collection('training_data')
      .doc(imageId)
      .update({trusted: true});
  }

  changeImageLabel(imageId, newLabel) {
    const ref = this.db.collection('training_data').doc(imageId);
    return ref.get().then(doc => {
      this.changeItemCount(doc.data().label, -1);
      this.changeItemCount(newLabel, 1);
      return ref.update({label: newLabel});
    });
  }

  deleteImage(imageId) {
    const ref = this.db.collection('training_data').doc(imageId);
    return ref.get().then(doc => {
      this.storage
        .child(`training_data/${doc.data().label}/${doc.id}.jpg`)
        .delete();
      this.changeItemCount(doc.data().label, -1);
      return ref.delete();
    });
  }

  async getImages(
    isTrusted = null,
    maxImages = 1,
    startAfter = 0,
    imageLabel = 'all'
  ) {
    let ref = this.db.collection('training_data');
    if (isTrusted !== null) ref = ref.where('trusted', '==', isTrusted);
    if (imageLabel !== 'all') ref = ref.where('label', '==', imageLabel);

    return ref
      .orderBy('timestamp')
      .startAfter(startAfter)
      .limit(maxImages)
      .get()
      .then(async snapshot =>
        Promise.all(
          snapshot.docs.map(async doc => {
            let url;
            try {
              url = await this.storage
                .child(`training_data/${doc.data().label}/${doc.id}.jpg`)
                .getDownloadURL();
            } catch (e) {
              url = null;
            }
            const {label, trusted, timestamp} = doc.data();
            return {
              id: doc.id,
              label,
              trusted,
              timestamp,
              url
            };
          })
        )
      );
  }

  async getStoreList() {
    if (this.storeList) return this.storeList;
    this.storeList = await getStore();
    return this.storeList;
  }
}

export default DataController;
