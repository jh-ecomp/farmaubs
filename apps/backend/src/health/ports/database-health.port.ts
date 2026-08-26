export abstract class DatabaseHealthPort {
  abstract isUp(): Promise<boolean>;
}
