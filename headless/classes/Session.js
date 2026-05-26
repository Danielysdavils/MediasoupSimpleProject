
class Session{
    constructor(id, name, creator, startDateTime, endDateTime, files, room){
        this.id = id;
        this.name = name;
        this.creator = creator;
        this.startDateTime = new Date(startDateTime);
        this.endDateTime = new Date(endDateTime);
        this.files = files; 
        this.status = "pending"; // pending | running | finished | cancelled
        this.room = room;
        this.index = 0;
    }

    isFinishedByTime(){
        return new Date() >= this.endDateTime;
    }
}

module.exports = Session;