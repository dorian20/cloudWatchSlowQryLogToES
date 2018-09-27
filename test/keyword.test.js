//MerchantReadOnlyDAO.selectWoitrMoninstInfoList

const keywords = 'DisplayShopReadOnlyDAO.selectCategoryTreeList,SubCampaignCommonReadOnlyDAO.selectGoodsSubCampaignMgtStatCheck,EtSupEntprzBrndReadOnlyDAO.searchBrndListCount,EtPickupPlcReadOnlyDAO.getEtPickupPlcDtl,CommonProhibitionWordReadOnlyDAO.selectProhibitionWordList,CcaCompensationTempletReadOnlyDAO.selectBusinessAllocationListCount,DisplayShopReadOnlyDAO.selectCategoryDshopNoSearchList,MbAffilatDmnReadOnlyDAO.selectMbAffilatDmnList,MbCustTermsReadOnlyDAO.selectMbCustTermsList,CenterInfoReadOnlyDAO.selectCenterInfo,PayCtrlNoticeReadOnlyDAO.existControl,CcaDashboardIntroReadOnlyDAO.selectIntroCnslList,VirTelNoMappingReadOnlyDAO.selectAllVirTelNo,CcaBusinessAllocationReadOnlyDAO.selectBusinessAllocationTypeList,CcaFaqTypeMgtReadOnlyDAO.getFaqTypeForSortTree,ActiveEventsReadOnlyDAO.selectConnectedCampaignInfo,CcaBusinessAllocationReadOnlyDAO.selectBusinessAllocationList,PaymentReadOnlyDAO.selectPgBnkCdMappingList,PaymentReadOnlyDAO.selectPgCardcoCdMappingList,BenefitReadOnlyDAO.selectFvrOfferCndt,OrderReadOnlyDAO.custOrdListInfo,MerchantReadOnlyDAO.selectWoitrMoninstInfoList,EtCrossPicShopReadOnlyDAO.searchClsfAddrCrossPicListCount';
const excpSqlID = keywords.split(',');
console.log('excpSqlID: ', excpSqlID);

// 송신 제외 쿼리 체크 (SQL ID 주석)
function checkExcpSqlID(sqlComment) {
  if (sqlComment !== null) {
    for (let inx = 0; inx < excpSqlID.length; inx++) {
      if (sqlComment.includes(excpSqlID[inx].toLowerCase())) {
        console.log('checkExcpSqlID(' + sqlComment + '): true');
        return true;
      }
    }
  }
  console.log('checkExcpSqlID(' + sqlComment + '): false');
  return false;
}

checkExcpSqlID('*+ [payment-api].merchantreadonlydao.selectwoitrmoninstinfolist *');