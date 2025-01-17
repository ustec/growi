import React from 'react';

import { UserPicture } from '@growi/ui';
import { format } from 'date-fns';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import { useIsTrashPage } from '~/stores/context';
import { usePageDeleteModal, usePutBackPageModal } from '~/stores/modal';
import { useSWRxPageInfo, useSWRxCurrentPage } from '~/stores/page';
import { useIsAbleToShowTrashPageManagementButtons } from '~/stores/ui';

const onDeletedHandler = (pathOrPathsToDelete) => {
  if (typeof pathOrPathsToDelete !== 'string') {
    return;
  }

  window.location.href = '/';
};

export const TrashPageAlert = (): JSX.Element => {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: isAbleToShowTrashPageManagementButtons } = useIsAbleToShowTrashPageManagementButtons();
  const { data: pageData } = useSWRxCurrentPage();
  const { data: isTrashPage } = useIsTrashPage();
  const pageId = pageData?._id;
  const pagePath = pageData?.path;
  const { data: pageInfo } = useSWRxPageInfo(pageId ?? null);


  const { open: openDeleteModal } = usePageDeleteModal();
  const { open: openPutBackPageModal } = usePutBackPageModal();

  if (!isTrashPage) {
    return <></>;
  }


  const deleteUser = pageData?.deleteUser;
  const deletedAt = pageData?.deletedAt ? format(new Date(pageData?.deletedAt), 'yyyy/MM/dd HH:mm') : '';
  const revisionId = pageData?.revision?._id;


  function openPutbackPageModalHandler() {
    if (pageId === undefined || pagePath === undefined) {
      return;
    }
    const putBackedHandler = () => {
      router.push(`/${pageId}`);
    };
    openPutBackPageModal({ pageId, path: pagePath }, { onPutBacked: putBackedHandler });
  }

  function openPageDeleteModalHandler() {
    if (pageId === undefined || revisionId === undefined || pagePath === undefined) {
      return;
    }
    const pageToDelete = {
      data: {
        _id: pageId,
        revision: revisionId,
        path: pagePath,
      },
      meta: pageInfo,
    };
    openDeleteModal([pageToDelete], { onDeleted: onDeletedHandler });
  }

  function renderTrashPageManagementButtons() {
    return (
      <>
        <button
          type="button"
          className="btn btn-info rounded-pill btn-sm ml-auto mr-2"
          onClick={openPutbackPageModalHandler}
          data-toggle="modal"
        >
          <i className="icon-action-undo" aria-hidden="true"></i> { t('Put Back') }
        </button>
        <button
          type="button"
          className="btn btn-danger rounded-pill btn-sm"
          disabled={!(pageInfo?.isAbleToDeleteCompletely ?? false)}
          onClick={openPageDeleteModalHandler}
        >
          <i className="icon-fire" aria-hidden="true"></i> { t('Delete Completely') }
        </button>
      </>
    );
  }

  return (
    <>
      <div className="alert alert-warning py-3 pl-4 d-flex flex-column flex-lg-row">
        <div className="flex-grow-1">
          This page is in the trash <i className="icon-trash" aria-hidden="true"></i>.
          <br />
          <UserPicture user={deleteUser} />
          <span className="ml-2">
            Deleted by { deleteUser?.name } at {deletedAt || pageData?.updatedAt}
          </span>
        </div>
        <div className="pt-1 d-flex align-items-end align-items-lg-center">
          { isAbleToShowTrashPageManagementButtons && renderTrashPageManagementButtons()}
        </div>
      </div>
    </>
  );
};
