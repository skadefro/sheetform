const { openiap } = require("@openiap/nodeapi");
async function main() {
    var client = new openiap();
    await client.connect();
    var workflow = {
        queue: "sheetform",
        name: "Sync sheet",
        _type: "workflow",
        web: true, rpa:false
    }
    workflow = await client.InsertOrUpdateOne({collectionname: "workflow", item: workflow, uniqeness: "queue"});
    var localqueue = await client.RegisterQueue({ queuename:workflow.queue}, async (msg, payload, user, jwt)=> {
        var instance = {workflow: workflow._id, targetid: user._id, state: "idle", form: "641c67761462f289854618ec", "name": workflow.name};
        try {
            // console.log("msg: " + JSON.stringify(msg));
            console.log("payload: " + JSON.stringify(payload));
            // new idle completed failed processing
            if(payload._id != null && payload._id != ""){
                var list = await client.Query({collectionname: "workflow_instances", query: {_id: payload._id}, jwt});
                if(list.length == 0) throw new Error("Instance " + payload._id + " not found");
                instance = list[0];
            } else {
                instance = await client.InsertOne({collectionname: "workflow_instances", item: instance, jwt});
            }
            if(instance.payload == null) instance.payload = {};
            instance.payload._id =instance._id
            instance.payload.text = "Hi mom " + new Date().toISOString();
            await client.UpdateOne({collectionname: "workflow_instances", item: instance, jwt});
            var sloifid = payload.sloifid
            if(payload.submitbutton != null && payload.submitbutton != "" && sloifid != null && sloifid != ""){
                instance.payload.text = "Send message to test" + payload.submitbutton + " at " + new Date().toISOString();
                instance.state = "idle"
                await client.UpdateOne({collectionname: "workflow_instances", item: instance, jwt});
                await client.QueueMessage({queuename: msg.replyto, data: instance, jwt});

                var result = await client.QueueMessage({queuename: payload.submitbutton, data: {sloifid},  jwt}, true);
                if(result == null || result == "") {
                    instance.payload.text += " - Result was null";
                } else {
                    instance.payload.text += " - Result was " + result;
                }
                instance.state = "completed"
                await client.UpdateOne({collectionname: "workflow_instances", item: instance, jwt});
            }

            return instance.payload;
        } catch (error) {
            console.error(error);
            var e = {"error": {"message": error.message}};
            if(instance != null && instance._id != null && instance._id != ""){
                instance.state = "failed";
                instance.error = error.message;
                try {
                    await client.UpdateOne({collectionname: "workflow_instances", item: instance});
                } catch (error) {
                }
            }
            return {...e, "payload": e}
        }
    })
    console.log("listening on " + localqueue);
}
main();