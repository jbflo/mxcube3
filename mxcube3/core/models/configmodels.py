from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class FlaskConfigModel(BaseModel):
    SECRET_KEY: str = Field(b"o`\xb5\xa5\xc2\x8c\xb2\x8c-?\xe0,/i#c", description="Flask secret key")
    SESSION_TYPE: str = Field("redis", description="Flask session type")
    SESSION_KEY_PREFIX: str = Field("mxcube:session:", description="Session prefix")
    DEBUG: bool = Field(False, description="")
    STREAMED_VIDEO: bool = Field(True, description="")
    ALLOWED_CORS_ORIGINS: List[str] = Field(["*"], description="")
    SECURITY_PASSWORD_SALT: str = Field("ASALT", description="")
    SECURITY_TRACKABLE: bool = Field(True, description="")
    USER_DB_PATH: str = Field("/tmp/mxcube-user.db", description="")

class UIComponentModel(BaseModel):
    label: str
    attribute: str
    role: Optional[str]
    step: Optional[float]
    precision: Optional[int]
    suffix: Optional[str]
    format: Optional[str]

    # Set internaly not to be set through configuration
    value_type: Optional[str]
    object_type: Optional[str]


class UIPropertiesModel(BaseModel):
    id: str
    components: List[UIComponentModel]


class UIPropertiesListModel(BaseModel):
    __root__: Dict[str, UIPropertiesModel]


class UserManagerUserConfigModel(BaseModel):
    username: str = Field("", description="username")
    role: str = Field("staff", description="Role to give user")


class UserManagerConfigModel(BaseModel):
    class_name: str = Field(
        "UserManager", description="UserManager class", alias="class"
        )
    inhouse_is_staff: bool = Field(
        True,
        description="Treat users defined as inhouse in session.xml as staff"
    )
    users: List[UserManagerUserConfigModel]

class ModeEnum(str, Enum):
    SSX_INJECTOR = 'SSX-INJECTOR'
    SSX_CHIP = 'SSX-CHIP'
    OSC = 'OSC'

class MXCUBEAppConfigModel(BaseModel):
    VIDEO_FORMAT: str = Field("MPEG1", description="Video format MPEG1 or MJPEG")
    VIDEO_STREAM_URL: str = Field("http://localhost:4042", description="Video stream URL")
    mode: ModeEnum = Field(ModeEnum.OSC, description="MXCuBE mode SSX or OSC")
    usermanager: UserManagerConfigModel
    ui_properties: Dict[str, UIPropertiesModel] = {}
    adapter_properties: List = []

class ModeEnumModel(BaseModel):
    mode: ModeEnum = Field(ModeEnum.OSC, description="MXCuBE mode SSX or OSC")

class AppConfigModel(BaseModel):
    server: FlaskConfigModel
    mxcube: MXCUBEAppConfigModel


