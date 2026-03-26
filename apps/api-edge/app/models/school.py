from sqlalchemy import Column, String
from app.core.database import Base

class School(Base):
    __tablename__ = "schools"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    region_id = Column(String, nullable=True)
    division = Column(String, nullable=True)
