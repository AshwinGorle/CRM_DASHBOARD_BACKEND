import { catchAsyncError } from "../../middlewares/catchAsyncError.middleware.js";
import ClientMasterModel from "../../models/ClientMasterModel.js";
import { ServerError } from "../../utils/customErrorHandler.utils.js";
import OpportunityMasterModel from "../../models/OpportunityMasterModel.js";
import uploadAndGetAvatarUrl from "../../utils/uploadAndGetAvatarUrl.utils.js";
import { getClientId } from "../../utils/client.utils.js";
import {
  getFilterOptions,
  getSortingOptions,
} from "../../utils/searchOptions.js";
import { parseContacts } from "../../service/clientService.js";
import { handleUpdateOpportunityId } from "../../service/opportunityService.js";
import { handleUpdateTenderId } from "../../service/tenderService.js";
import TerritoryModel from "../../models/Configuration/TerritoryModel.js";
import RegistrationMasterModel from "../../models/RegistrationMasterModel.js";
import BusinessDevelopmentModel from "../../models/BusinessDevelopmentModel.js";
import TenderMasterModel from "../../models/TenderMasterModel.js";
import StageHistoryModel from "../../models/HistoryModels/StageHistoryModel.js";
import SubStageHistoryModel from "../../models/HistoryModels/SubSageHistoryModel.js";
import RevenueMasterModel from "../../models/RevenueMasterModel.js";

class ClientMasterController {
  static createClient = catchAsyncError(async (req, res) => {
    let {
      name,
      entryDate,
      enteredBy = req?.user?._id,
      industry,
      subIndustry,
      offering,
      territory,
      PursuedOpportunityValue,
      incorporationType,
      listedCompany,
      marketCap,
      annualRevenue,
      classification,
      totalEmployeeStrength,
      itEmployeeStrength,
      primaryRelationship,
      secondaryRelationship,
      relatedContacts,
      relationshipStatus,
      lifeTimeValue,
      priority,
      detailsConfirmation,
      createdAt,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !industry ||
      !subIndustry ||
      !territory ||
      !incorporationType ||
      !annualRevenue
    ) {
      return res.status(400).json({
        status: "failed",
        message: "All required fields must be filled",
      });
    }

    // Manual validation for entryDate
    entryDate = new Date(entryDate);
    if (isNaN(entryDate.getTime())) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid entryDate" });
    }

    // Create a new instance of the ClientMasterModel
    let newClient = new ClientMasterModel({
      clientCode: getClientId(),
      name,
      entryDate,
      enteredBy,
      industry,
      subIndustry,
      offering,
      territory,
      PursuedOpportunityValue,
      incorporationType,
      listedCompany,
      marketCap,
      annualRevenue,
      classification,
      totalEmployeeStrength,
      itEmployeeStrength,
      primaryRelationship,
      secondaryRelationship,
      relatedContacts: [],
      relationshipStatus,
      lifeTimeValue,
      priority,
      detailsConfirmation,
      createdAt,
    });

    // Ensure relatedContacts is an array and not empty
    await parseContacts(relatedContacts, newClient);

    // handles avatar changes in client
    if (req.file) {
      const avatarUrl = await uploadAndGetAvatarUrl(
        req.file,
        "client",
        newClient._id,
        "stream"
      );
      newClient.avatar = avatarUrl;
    }

    // Save the instance after all modifications are done
    await newClient.save();

    const client = await ClientMasterModel.findById(newClient._id)
      .populate("enteredBy")
      .populate("industry")
      .populate("subIndustry")
      .populate("territory")
      .populate("incorporationType")
      .populate("classification")
      .populate("primaryRelationship")
      .populate("secondaryRelationship")
      .populate("relationshipStatus");

    res.status(201).json({
      status: "success",
      message: "Client created successfully",
      data: client,
    });
  });

  static getAllClient = catchAsyncError(async (req, res, next, session) => {
    console.log("get all clients req");
    const limit = parseInt(req.query.limit) || 12;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const { config } = req.query;
    const filterOptions = getFilterOptions(req.query);
    const sortingOptions = getSortingOptions(req.query);
    console.log("filter", filterOptions);
    console.log("sorting", sortingOptions);
    
    if (config === "true") {
      const clients = await ClientMasterModel.find(filterOptions).select("name");
      return res.send({ config: true, clients });
    }

    const totalCount = await ClientMasterModel.countDocuments(filterOptions);
    const clientMasters = await ClientMasterModel.find(filterOptions)
      .sort(sortingOptions)
      .skip(skip)
      .limit(limit)
      .populate("enteredBy")
      .populate("industry")
      .populate("subIndustry")
      .populate("territory")
      .populate("incorporationType")
      .populate("classification")
      .populate("primaryRelationship")
      .populate("secondaryRelationship")
      .populate("relationshipStatus")
      .populate("relatedContacts")
      .session(session);

    res.status(200).json({
      status: "success",
      message: "All Client Masters retrieved successfully",
      data: { page, limit, totalCount, clients: clientMasters },
    });
  });

  static getClientById = catchAsyncError(async (req, res, next) => {
    const { id } = req.params;
    const client = await ClientMasterModel.findById(id)
      .populate("enteredBy")
      .populate("industry")
      .populate("subIndustry")
      .populate("territory")
      .populate("incorporationType")
      .populate("classification")
      .populate("primaryRelationship")
      .populate("secondaryRelationship")
      .populate("relationshipStatus")

    res.status(200).json({
      status: "success",
      message: "Client retrieved successfully",
      data: client,
    });
  });

  static updateClient = catchAsyncError(async (req, res, next, session) => {
    const { id } = req.params;
    const updateData = req.body;
    console.log("update client req : ", updateData);
    const client = await ClientMasterModel.findById(id).populate("territory");

    if (!client) throw new ServerError("NotFound", "Client");

    // Updating directly updatable fields
    Object.keys(updateData).forEach((key) => {
      if (key != "relatedContacts") client[key] = updateData[key];
    });

    // Parsing Related contacts
    if (updateData.relatedContacts)
      await parseContacts(updateData.relatedContacts, client);

    // Handle Client Avatar change
    if (req.file) {
      client.avatar = await uploadAndGetAvatarUrl(
        req.file,
        "client",
        client._id,
        "stream"
      );
    }
    await client.validate();
    await client.save({ session });
    // on change of ( territory || name ) we have to update tenders and opportunities custom id associated with this client
    if (updateData.territory || updateData.name) {
      if (updateData.territory)
        client.territory = await TerritoryModel.findById(client.territory);
      await handleUpdateOpportunityId(
        client._id,
        client.name,
        client.territory,
        session
      );
      await handleUpdateTenderId(
        client._id,
        client.name,
        client.territory,
        session
      );
    }
    // setTimeout(async () => {}, 1000);
    let populatedClient = await ClientMasterModel.findById(id)
      .session(session)
      .populate("enteredBy")
      .populate("industry")
      .populate("subIndustry")
      .populate("territory")
      .populate("incorporationType")
      .populate("classification")
      .populate("primaryRelationship")
      .populate("secondaryRelationship")
      .populate("relationshipStatus");

    res.status(200).json({
      status: "success",
      message: "Client updated successfully",
      data: populatedClient,
    });
  }, true);

  // static deleteClient = catchAsyncError(async (req, res, next, session) => {
  //     const { id } = req.params;
  //     let { confirm } = req.query;
  //     confirm = confirm == "true" ? true : false;
  //     const client = await ClientMasterModel.findById(id);
  //     //note every operation should be done in session which we are receiving in param

  //     // part 1 (if confirmation is false) where we will just fetch all the related documents which will be deleted if the client is deleted, we will not delete
  //     // just return all this to frontend and will actually delete in part 2 (if confirmation is true)

  //     // step 1: fetch all the opportunities related to the client while populating the associatedTender field of opportunity

  //     // step 2: fetch all the registrations which has this client in the client field of it

  //     // step 3: fetch all the business developments which has this client in the client field of it

  //     // step 4: now we have to return this to frontend in response so that i can show what things will be deleted on deleting the client
  //     // send res in this format
  //     // return res.status(200).json({
  //     //     status: "success",
  //     //     message: "Items that would be deleted (no actual deletion performed)",
  //     //     data: {
  //     //       client,
  //     //       opportunities,
  //     //       registrations,
  //     //       businessDevelopments,
  //     //     },
  //     //   });

  //     // part 2 actual deletion of documents if confirm is true

  //     // step 1 : in each opportunity there is field stageHistory which is an array of stageHistory document reference we have to delete all this

  //     // step 2 : in each stageHistory there is field subStageHistory which  is array of reference ids of subStageHistory document we have to delete all this

  //     // step 3 : in each opportunity there is field revenue which is array of reference ids of revenue document so we have to delete all this also

  //     // step 4 : now in all or some opportunities there may be tender now we have to delete all these tenders too

  //     // step 5 : now finally we can delete the opportunities

  //     // step 6 : now delete the fetched registrations

  //     // step 7 : now delete the fetched businessDevelopments

  //     // step 8 : now finally we can delete the client

  //     // in response we have to send all the deleted items in response
  //     // res.status(200).json({
  //     //     status: 'success',
  //     //     message: 'Client deleted successfully',
  //     //     data: {
  //     //         client,
  //     //         tenders,
  //     //         opportunities,
  //     //         registrations,
  //     //         businessDevelopments
  //     //     }
  //     // });
  // },true);

  static deleteClient = catchAsyncError(async (req, res, next, session) => {
    console.log("delete client called");
    const { id } = req.params;
    let { confirm } = req.query;
    confirm = confirm == "true";
    confirm = false; // have to delete this line in production
    const client = await ClientMasterModel.findById(id)
      .populate(
        "territory industry subIndustry incorporationType classification relationshipStatus"
      )
      .populate("enteredBy", "firstName lastName avatar")
      .populate("primaryRelationship", "firstName lastName avatar")
      .populate("secondaryRelationship", "firstName lastName avatar");
    if (!client) {
      return res.status(404).json({
        status: "fail",
        message: "Client not found",
      });
    }

    // Part 1: Fetch related documents for preview
    if (!confirm) {
      const opportunities = await OpportunityMasterModel.find({ client: id })
        .populate({
          path: "associatedTender",
          populate: [
            { path: "bidManager", select: "firstName lastName avatar" },
            { path: "officer", select: "firstName lastName avatar" },
            { path: "enteredBy", select: "firstName lastName avatar" },
            { path: "associatedOpportunity", select: "customId projectName" },
            { path: "stage" },
          ],
        })
        .populate("salesChamp", "firstName lastName avatar")
        .populate("salesStage salesSubStage solution")
        .session(session);

      const registrations = await RegistrationMasterModel.find({ client: id })
        .populate("enteredBy", "firstName lastName avatar")
        .populate("registrationChamp", " avatar firstName lastName")
        .session(session);

      const businessDevelopments = await BusinessDevelopmentModel.find({
        client: id,
      })
        .populate("client", "name customId avatar")
        .populate("salesChamp", "firstName lastName avatar")
        .populate("solution subSolution industry territory")
        .session(session);

      return res.status(200).json({
        status: "success",
        message: "Items that would be deleted (no actual deletion performed)",
        data: {
          client,
          opportunities,
          registrations,
          businessDevelopments,
          confirm: confirm,
        },
      });
    }

    // Part 2: Actual deletion
    const opportunities = await OpportunityMasterModel.find({
      client: id,
    }).session(session);
    const registrations = await RegistrationMasterModel.find({
      client: id,
    }).session(session);
    const businessDevelopments = await BusinessDevelopmentModel.find({
      client: id,
    }).session(session);

    const tenderIdsToDelete = [];
    const stageHistoriesToDelete = [];
    const subStageHistoriesToDelete = [];
    const revenuesToDelete = [];

    // Step 1-4: Process opportunities and related documents
    for (const opportunity of opportunities) {
      if (opportunity.stageHistory) {
        stageHistoriesToDelete.push(...opportunity.stageHistory);
      }
      if (opportunity.revenue) {
        revenuesToDelete.push(...opportunity.revenue);
      }
      if (opportunity.associatedTender) {
        tenderIdsToDelete.push(opportunity.associatedTender);
      }
    }

    // Fetch tender documents based on collected IDs
    const tendersToDelete = await TenderMasterModel.find({
      _id: { $in: tenderIdsToDelete },
    }).session(session);

    // Step 2: Fetch sub-stage histories from stage histories
    for (const stageHistoryId of stageHistoriesToDelete) {
      const stageHistory = await StageHistoryModel.findById(
        stageHistoryId
      ).session(session);
      if (stageHistory && stageHistory.subStageHistory) {
        subStageHistoriesToDelete.push(...stageHistory.subStageHistory);
      }
    }

    // Delete all related documents
    await SubStageHistoryModel.deleteMany({
      _id: { $in: subStageHistoriesToDelete },
    }).session(session);
    await StageHistoryModel.deleteMany({
      _id: { $in: stageHistoriesToDelete },
    }).session(session);
    await RevenueMasterModel.deleteMany({
      _id: { $in: revenuesToDelete },
    }).session(session);
    await TenderMasterModel.deleteMany({
      _id: { $in: tenderIdsToDelete },
    }).session(session);
    await OpportunityMasterModel.deleteMany({ client: id }).session(session);
    await RegistrationMasterModel.deleteMany({ client: id }).session(session);
    await BusinessDevelopmentModel.deleteMany({ client: id }).session(session);

    // Finally, delete the client
    await ClientMasterModel.findByIdAndDelete(id).session(session);

    return res.status(200).json({
      status: "success",
      message: "Client and related entries deleted successfully",
      data: {
        client,
        tenders: tendersToDelete, // Now sending actual tender documents
        opportunities,
        registrations,
        businessDevelopments,
        confirm: confirm,
      },
    });
  }, true);
}
export default ClientMasterController;
