from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db, require_roles
from ..models import User, UserRole
from ..schemas import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_profile(current_user: User = Depends(require_roles(*[role.value for role in UserRole]))) -> UserOut:
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
def update_profile(
    payload: UserUpdate,
    current_user: User = Depends(require_roles(*[role.value for role in UserRole])),
    db: Session = Depends(get_db),
) -> UserOut:
    current_user.full_name = payload.full_name
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)
