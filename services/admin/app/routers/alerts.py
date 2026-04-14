from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db, require_internal_token
from ..models import AlertRule, ResourceStatus
from ..schemas import AlertRuleOut

router = APIRouter(prefix="/internal", tags=["alerts"])


@router.get("/alert-rules", response_model=list[AlertRuleOut], dependencies=[Depends(require_internal_token)])
def list_alert_rules(db: Session = Depends(get_db)) -> list[AlertRuleOut]:
    rules = db.query(AlertRule).filter(AlertRule.status == ResourceStatus.ACTIVE.value).all()
    return [AlertRuleOut.model_validate(rule) for rule in rules]
