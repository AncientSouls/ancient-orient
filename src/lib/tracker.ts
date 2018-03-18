import * as _ from 'lodash';

import {
  TClass,
  IInstance,
} from 'ancient-mixins/lib/mixins';

import {
  Node,
  INode,
  INodeEventsList,
} from 'ancient-mixins/lib/node';

type TTracker =  ITracker<ITrackerEventsList>;

type TIndex = number;
type TId = number|string;

interface IVersion {
  changed: boolean;
  memory?: any;
}

interface IItem {
  id: TId;
  version?: IVersion;
  index?: TIndex;
  data?: any;
}

interface ITrackerEventItemData {
  id: TId;
  changed?: boolean;
  data?: any;
  oldIndex?: TIndex;
  newIndex?: TIndex;
  tracker: TTracker;
}

interface ITrackerEventsList extends INodeEventsList {
  added: ITrackerEventItemData;
  changed: ITrackerEventItemData;
  removed: ITrackerEventItemData;
}

interface ITrackingResults {
  stop: ITrackingStop;
  items: IItem[];
}

interface ITrackingStop {
  (): void;
}

interface ITrackingStart {
  (tracker: TTracker): Promise<ITrackingResults>;
}

interface ITracker<IEventsList extends ITrackerEventsList> extends INode<IEventsList> {
  ids: TId[];
  versions: { [id: string]: IVersion };

  query: any;
  start: ITrackingStart;
  stop: ITrackingStop;
  tracking: any;

  add(item: IItem): void;
  change(item: IItem): void;
  remove(item: IItem): void;

  override(items: IItem[]): void;
  clean(): void;

  resubscribe(query: any, start: ITrackingStart): Promise<IItem[]>;
  unsubscribe(): Promise<void>;
}

function mixin<T extends TClass<IInstance>>(
  superClass: T,
): any {
  return class Tracker extends superClass {
    ids = [];
    versions = {};

    query = null;
    start = null;
    stop = null;
    tracking: any;

    add(item) {
      const { id, version, index, data } = item;
      const { changed } = version;
      this.versions[id] = version;
      this.ids.splice(index, 0, id);

      const oldIndex = -1;
      const newIndex = index;

      this.emit('added', {
        id, changed, data,
        oldIndex, newIndex,
        tracker: this,
      });
    }

    change(item) {
      const { id, version, index, data } = item;
      const { changed } = version;
      const oldIndex = this.ids.indexOf(id);
      const newIndex = index;

      if (oldIndex !== newIndex) {
        this.ids.splice(oldIndex, 1);
        this.ids.splice(newIndex, 0, id);
      } 
      
      this.versions[id] = version;

      this.emit('changed', {
        id, changed, data,
        oldIndex, newIndex,
        tracker: this,
      });
    }

    remove(item) {
      const { id, version, index, data } = item;
      const oldIndex = this.ids.indexOf(id);
      const newIndex = -1;

      this.ids.splice(oldIndex, 1);
      delete this.versions[id];

      this.emit('removed', {
        id,
        oldIndex, newIndex,
        tracker: this,
      });
    }

    override(items) {
      const ids = _.map(items, (i: any) => i.id);
      const oldIds = _.difference(this.ids, ids);
      
      _.each(oldIds, (id) => {
        this.remove({ id });
      });
      _.each(items, (item) => {
        if (_.has(this.versions, item.id)) {
          if (
            item.version.changed ||
            item.index !== this.ids.indexOf(item.id)
          ) {
            this.change(item);
          }
        } else {
          this.add(item);
        }
      });
    }

    clean() {
      _.each(_.cloneDeep(this.ids), (id) => {
        this.remove({ id });
      });
    }

    async resubscribe(query, start) {
      this.query = query;
      this.start = start;
      await this.unsubscribe();
      const { stop, items } = await this.start(this);
      this.stop = stop;
      return items;
    }
    async unsubscribe() {
      if (this.stop) await this.stop();
    }
  };
}

const MixedTracker: TClass<TTracker> = mixin(Node);
class Tracker extends MixedTracker {}

export {
  mixin as default,
  mixin,
  MixedTracker,
  Tracker,
  ITracker,
  ITrackerEventsList,
  TTracker,
  TIndex,
  TId,
  IVersion,
  IItem,
  ITrackerEventItemData,
  ITrackingStart,
  ITrackingStop,
  ITrackingResults,
};
